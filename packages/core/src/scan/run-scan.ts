/**
 * Orchestrate full/diff scans: collect files, classify their roles (DUST-20), run adapters with cache,
 * write report.json under outputDir only.
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  Finding,
  REPORT_SCHEMA_ID,
  Report,
  type FileRoleType,
  type FindingCategoryType,
  type FindingType,
  type ReportType,
  type ScanToolType,
} from "@dustmap/contract";
import type { Adapter } from "../adapter.js";
import { loadConfig, resolveOutputDir, type LoadConfigResult } from "../config/load.js";
import type { DustmapConfig } from "../config/schema.js";
import { toPosix } from "../posix.js";
import { dedupeSemanticAgainstClones } from "../semantic/dedupe-vs-clones.js";
import { openAdapterCache } from "./cache.js";
import { gitHead } from "./git.js";
import { takeInventory } from "./inventory.js";

export type RunScanOptions = {
  repoRoot: string;
  mode: "full" | "diff";
  /** Required for diff mode. */
  baseRef?: string;
  adapters: Adapter[];
  /** Optional path to config (may be outside repo). */
  configPath?: string;
  /** Override config.outputDir for this run. */
  outputDir?: string;
  /**
   * Commit id recorded in the report. Use when scanning a snapshot tree whose local HEAD is not
   * the pinned source SHA (fresh `git init` after `git archive`). Defaults to `git rev-parse HEAD`.
   */
  commit?: string;
};

export type RunScanResult = {
  report: ReportType;
  reportPath: string;
  outputDir: string;
  /** How many times Adapter.run was actually invoked (cache misses). */
  adapterRuns: number;
  filesScanned: string[];
};

function emptyByCategory(): Record<FindingCategoryType, number> {
  return {
    "dead-code": 0,
    duplicate: 0,
    "semantic-duplicate": 0,
    "refactor-signal": 0,
    structure: 0,
  };
}

function summarize(findings: FindingType[]) {
  const byCategory = emptyByCategory();
  const placeScores = new Map<string, { score: number; fps: Set<string> }>();
  for (const f of findings) {
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
    for (const loc of f.locations) {
      const cur = placeScores.get(loc.path) ?? { score: 0, fps: new Set() };
      cur.score += 1;
      cur.fps.add(f.fingerprint);
      placeScores.set(loc.path, cur);
    }
  }
  const topPlaces = [...placeScores.entries()]
    .map(([p, v]) => ({
      path: p,
      score: v.score,
      findingFingerprints: [...v.fps].sort(),
    }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, 20);
  return { byCategory, topPlaces };
}

function listRepoFiles(repoRoot: string): Set<string> {
  const out = new Set<string>();
  function walk(abs: string): void {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name === ".git") continue;
      const child = path.join(abs, ent.name);
      if (ent.isDirectory()) walk(child);
      else if (ent.isFile()) out.add(toPosix(path.relative(repoRoot, child)));
    }
  }
  walk(repoRoot);
  return out;
}

/** Snapshot of relative paths currently in the repo (for isolation assertions in tests). */
export function snapshotRepoPaths(repoRoot: string): string[] {
  return [...listRepoFiles(repoRoot)].sort();
}

export async function runScan(opts: RunScanOptions): Promise<RunScanResult> {
  const repoRoot = path.resolve(opts.repoRoot);
  const loaded: LoadConfigResult = loadConfig(repoRoot, opts.configPath);
  const config: DustmapConfig = opts.outputDir
    ? { ...loaded.config, outputDir: opts.outputDir }
    : loaded.config;

  const outputDir = resolveOutputDir(repoRoot, config.outputDir);
  mkdirSync(outputDir, { recursive: true });

  const { files, contents, cacheKeys, roles, byRole } = takeInventory(repoRoot, config, opts.mode, opts.baseRef);
  const filesWithRole = (...wanted: FileRoleType[]) => files.filter((f) => wanted.includes(roles.get(f)!));
  const readFile = async (rel: string) => {
    const hit = contents.get(rel);
    if (hit !== undefined) return hit;
    return readFileSync(path.join(repoRoot, rel), "utf8");
  };

  const enabledAdapters = opts.adapters.filter((a) => {
    const cfg = config.adapters[a.name];
    return cfg?.enabled !== false;
  });

  if (enabledAdapters.length === 0) {
    throw new Error("No adapters enabled for this scan");
  }

  const tools: ScanToolType[] = [];
  const findings: FindingType[] = [];
  let adapterRuns = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  for (const adapter of enabledAdapters) {
    const version = adapter.version();
    const cache = openAdapterCache(outputDir, adapter.name, version);
    const cached = cache.tryGet(files, cacheKeys);
    if (cached) {
      cacheHits += cache.stats.hits;
      findings.push(...cached);
      tools.push({ name: adapter.name, version });
      continue;
    }
    cacheMisses += cache.stats.misses;
    try {
      adapterRuns++;
      const produced = await adapter.run({
        repoRoot,
        files,
        roles,
        filesWithRole,
        config,
        mode: opts.mode,
        readFile,
      });
      const parsed = Finding.array().parse(produced);
      cache.put(files, cacheKeys, parsed);
      findings.push(...parsed);
      tools.push({ name: adapter.name, version });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      tools.push({ name: adapter.name, version, error: message });
    }
  }

  // Dedupe by fingerprint (last wins), then drop semantic clusters already covered by token clones.
  const byFp = new Map<string, FindingType>();
  for (const f of findings) byFp.set(f.fingerprint, f);
  const unique = dedupeSemanticAgainstClones([...byFp.values()]);

  const report = Report.parse({
    schema: REPORT_SCHEMA_ID,
    scan: {
      mode: opts.mode,
      commit: opts.commit ?? gitHead(repoRoot),
      ...(opts.mode === "diff" && opts.baseRef ? { baseRef: opts.baseRef } : {}),
      startedAt: new Date().toISOString(),
      tools,
      cache: { hits: cacheHits, misses: cacheMisses },
      files: { total: files.length, byRole },
    },
    summary: summarize(unique),
    findings: unique,
  });

  const reportPath = path.join(outputDir, "report.json");
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return { report, reportPath, outputDir, adapterRuns, filesScanned: files };
}

/** True when absPath is outside repoRoot (after resolve). */
export function isOutsideRepo(repoRoot: string, absPath: string): boolean {
  const root = path.resolve(repoRoot);
  const target = path.resolve(absPath);
  const rel = path.relative(root, target);
  return rel.startsWith("..") || path.isAbsolute(rel);
}

export function assertPathIsFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}
