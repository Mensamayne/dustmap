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
  type FindingType,
  type ReportType,
  type ScanToolType,
} from "@dustmap/contract";
import type { Adapter } from "../adapter.js";
import { loadConfig, resolveOutputDir, type LoadConfigResult } from "../config/load.js";
import type { DustmapConfig } from "../config/schema.js";
import { applyDecisions, loadDecisions } from "../decisions/index.js";
import { toPosix } from "../posix.js";
import { rankingWeightsFromConfig, summarizeFindings } from "../rank/index.js";
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
  // keep / wontfix mute from ranking and category counts (fingerprint change brings them back).
  const visible = applyDecisions(unique, loadDecisions(outputDir));
  const summary = summarizeFindings(visible, rankingWeightsFromConfig(config.ranking));

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
    summary,
    findings: visible,
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
