#!/usr/bin/env node
/**
 * Scan a real target repo read-only and print the numbers (files per role, time, findings).
 *
 *   npm run target -- <name>                  live: the target's working tree as it is now
 *   npm run target -- <name> --snapshot <sha> pinned: `git archive <sha>` copied into .tmp, repeatable
 *   npm run target -- --path <dir> [--label x] ad-hoc target (used by the self-test)
 *
 * Invariants: nothing is ever written inside the target; the only git commands run against the
 * target are read-only (`rev-parse`, `archive`); the target's own scripts are never executed.
 * Output: .tmp/targets/<label>/{inventory.json, out/report.json}. Exit 2 = target unavailable.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Report } from "../../packages/contract/src/index.ts";
import {
  builtinAdapters,
  defaultConfig,
  detectProject,
  isOutsideRepo,
  loadConfig,
  takeInventory,
  type DustmapConfigType,
} from "../../packages/core/src/index.ts";
import { loadTargets } from "./registry.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dustmapBin = path.join(repo, "packages", "cli", "bin", "dustmap.mjs");
const targets = loadTargets() as Record<string, { path: string; env: string; config: string | null }>;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function fail(code: number, message: string): never {
  console.error(message);
  process.exit(code);
}

const name = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : undefined;
const adHoc = arg("path");
const snapshot = arg("snapshot");
if (!name && !adHoc) fail(2, `Użycie: npm run target -- <${Object.keys(targets).join("|")}> [--snapshot <sha>]  albo  --path <katalog>`);

let targetDir: string;
let configPath: string | null = null;
let label: string;
if (adHoc) {
  targetDir = path.resolve(adHoc);
  label = arg("label") ?? path.basename(targetDir);
} else {
  const t = targets[name!];
  if (!t) fail(2, `Nie ma celu „${name}”. Dostępne: ${Object.keys(targets).join(", ")}`);
  targetDir = path.resolve(repo, process.env[t.env] ?? t.path);
  configPath = t.config ? path.join(repo, t.config) : null;
  label = name!;
}
if (!existsSync(targetDir)) fail(2, `Cel niedostępny: ${label} (${targetDir}). Ustaw ścieżkę zmienną środowiskową albo sklonuj repo obok.`);

const git = (cwd: string, args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/**
 * Extensions and project files a scan needs, as git pathspecs (archive keeps the snapshot small).
 * `git archive` fails on a pathspec that matches nothing, so only pathspecs with a match at `sha` are kept.
 */
function snapshotPathspecs(config: DustmapConfigType, sha: string): string[] {
  const exts = new Set<string>();
  for (const pattern of config.include) {
    const m = pattern.match(/\*\.\{?([a-z0-9,]+)\}?$/i);
    for (const e of m?.[1]?.split(",") ?? []) exts.add(e.toLowerCase());
  }
  const names = new Set(["package.json", "tsconfig.json", ".gitignore", ".gitattributes"]);
  const tree = execFileSync("git", ["ls-tree", "-r", "-z", "--name-only", sha], {
    cwd: targetDir,
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  }).split("\0");
  const seenExt = new Set<string>();
  const seenName = new Set<string>();
  let tsconfigVariants = false;
  for (const file of tree) {
    const base = file.slice(file.lastIndexOf("/") + 1);
    const ext = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1).toLowerCase() : "";
    if (exts.has(ext)) seenExt.add(ext);
    if (names.has(base)) seenName.add(base);
    if (/^tsconfig\..+\.json$/.test(base)) tsconfigVariants = true;
  }
  return [
    ...[...seenExt].map((e) => `:(glob)**/*.${e}`),
    ...[...seenName].map((n) => `:(glob)**/${n}`),
    ...(tsconfigVariants ? [":(glob)**/tsconfig.*.json"] : []),
  ];
}

function extractSnapshot(sha: string, dest: string, config: DustmapConfigType): string {
  const full = git(targetDir, ["rev-parse", "--verify", `${sha}^{commit}`]);
  const marker = path.join(dest, ".dustmap-snapshot");
  const pathspecs = snapshotPathspecs(config, full);
  // The marker names the commit and the file set: adding an extension (CSS, DUP-01) re-extracts.
  const stamp = `${full}\n${pathspecs.join("\n")}`;
  if (existsSync(marker) && readFileSync(marker, "utf8").trim() === stamp) return full;
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  const archive = spawnSync("git", ["archive", "--format=tar", full, "--", ...pathspecs], {
    cwd: targetDir,
    maxBuffer: 2 * 1024 * 1024 * 1024,
  });
  if (archive.status !== 0) fail(1, `git archive nie powiodło się: ${archive.stderr.toString()}`);
  const untar = spawnSync("tar", ["-x", "-f", "-"], { cwd: dest, input: archive.stdout, maxBuffer: 64 * 1024 * 1024 });
  if (untar.status !== 0) fail(1, `Rozpakowanie migawki nie powiodło się: ${untar.stderr.toString()}`);
  // A fresh repo in the copy (never in the target) so .gitignore / .gitattributes rules apply as in the original.
  git(dest, ["init", "-q"]);
  writeFileSync(path.join(dest, ".git", "info", "exclude"), ".dustmap-snapshot\n");
  writeFileSync(marker, `${stamp}\n`);
  return full;
}

const baseConfig = configPath ? loadConfig(targetDir, configPath).config : defaultConfig();
const runLabel = snapshot ? `${label}@${snapshot.slice(0, 12)}` : label;
const workDir = path.join(repo, ".tmp", "targets", runLabel);
const outDir = path.join(workDir, "out");

let scanRoot = targetDir;
let commit: string;
if (snapshot) {
  commit = extractSnapshot(snapshot, path.join(workDir, "src"), baseConfig);
  scanRoot = path.join(workDir, "src");
} else {
  try {
    commit = git(targetDir, ["rev-parse", "HEAD"]);
  } catch {
    commit = "uncommitted";
  }
}
if (!isOutsideRepo(targetDir, outDir) && !(snapshot === undefined && label === "self")) {
  fail(1, `Odmowa: katalog wyniku ${outDir} leży w celu ${targetDir}.`);
}

const detected = detectProject(scanRoot);
const config: DustmapConfigType = {
  ...baseConfig,
  entryPoints: [...new Set([...baseConfig.entryPoints, ...detected.entryPoints])].sort(),
  outputDir: outDir,
};

const t0 = Date.now();
const inv = takeInventory(scanRoot, config);
const inventoryMs = Date.now() - t0;

const adapters = builtinAdapters();
let scan: { ms: number; findings: number; byCategory: Record<string, number>; reportPath: string } | null = null;
if (adapters.length) {
  const t1 = Date.now();
  const writtenConfig = path.join(workDir, "dustmap.config.json");
  mkdirSync(workDir, { recursive: true });
  writeFileSync(writtenConfig, `${JSON.stringify(config, null, 2)}\n`);
  // DUST-19: scan through the real CLI bin (same path humans/agents use), not runScan in-process.
  const cliArgs = [
    dustmapBin,
    "scan",
    scanRoot,
    "--config",
    writtenConfig,
    "--out",
    outDir,
    ...(snapshot ? ["--commit", commit] : []),
  ];
  const cli = spawnSync(process.execPath, cliArgs, {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (cli.status !== 0) {
    fail(
      cli.status === 2 ? 2 : 1,
      `dustmap scan failed (exit ${cli.status}): ${cli.stderr || cli.stdout}`,
    );
  }
  const reportPath = path.join(outDir, "report.json");
  const report = Report.parse(JSON.parse(readFileSync(reportPath, "utf8")));
  scan = {
    ms: Date.now() - t1,
    findings: report.findings.length,
    byCategory: report.summary.byCategory,
    reportPath,
  };
}

const skipped = inv.files
  .filter((f) => inv.roles.get(f) !== "source" && inv.roles.get(f) !== "test")
  .map((f) => ({ path: f, role: inv.roles.get(f), reason: inv.reasons.get(f) }));

mkdirSync(workDir, { recursive: true });
writeFileSync(
  path.join(workDir, "inventory.json"),
  `${JSON.stringify(
    {
      target: label,
      mode: snapshot ? "snapshot" : "live",
      commit,
      files: { total: inv.files.length, byRole: inv.byRole },
      entryPoints: config.entryPoints.length,
      unresolvedEntryPoints: detected.unresolvedEntryPoints,
      skipped,
      timingsMs: { inventory: inventoryMs, ...(scan ? { scan: scan.ms } : {}) },
      scan,
    },
    null,
    2,
  )}\n`,
);

const r = inv.byRole;
console.log(`Cel: ${label} (${snapshot ? `migawka ${commit.slice(0, 12)}` : "na żywo"}) — ${scanRoot}`);
console.log(`Pliki: ${inv.files.length} · kod ${r.source} · testy ${r.test} · pominięte ${skipped.length} (generowane ${r.generated}, zminifikowane ${r.minified}, cudze ${r.vendored}, za duże ${r.oversized}, deklaracje ${r.declaration}, dane testowe ${r.fixture})`);
console.log(`Punkty wejścia: ${config.entryPoints.length} · nierozwiązane: ${detected.unresolvedEntryPoints.length}`);
console.log(`Czas inwentarza: ${(inventoryMs / 1000).toFixed(1)} s`);
if (scan) {
  console.log(`Skan: ${(scan.ms / 1000).toFixed(1)} s · znaleziska ${scan.findings} ${JSON.stringify(scan.byCategory)}`);
} else {
  console.log("Wykrywacze: brak (pierwszy przychodzi z adapterem martwego kodu) — raport znalezisk nie powstał.");
}
console.log(`Wynik: ${path.relative(repo, workDir)}${path.sep}inventory.json`);
