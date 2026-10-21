/**
 * falsegreen-js adapter — static scan for false-green / weak-oracle tests. Never writes into the
 * scanned repo; temp hardlink tree under os.tmpdir only (same Windows-safe pattern as jscpd).
 */
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, linkSync, mkdirSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Adapter, AdapterContext } from "../../adapter.js";
import { toPosix } from "../../posix.js";
import { normalizeFalsegreenReport, parseFalsegreenOptions, pathHasTmpSegment } from "./normalize.js";
import type { FalsegreenJsonReport } from "./types.js";

/** Bump when selection/normalize mapping changes so content-hash cache does not serve stale findings. */
const ADAPTER_REV = 1;

type FgPkg = { name?: string; version: string; bin?: string | Record<string, string> };

/**
 * Locate falsegreen-js without require.resolve / import.meta.resolve — the package exports only
 * ESM `import`, and Vitest strips import.meta.resolve. Walk node_modules from this file and cwd.
 */
function falsegreenPackageRoot(): string {
  const starts = [path.dirname(fileURLToPath(import.meta.url)), process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (;;) {
      const candidate = path.join(dir, "node_modules", "falsegreen-js", "package.json");
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, "utf8")) as FgPkg;
        if (pkg.name === "falsegreen-js") return path.dirname(candidate);
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error("Could not locate falsegreen-js package root");
}

function readFgPkg(): FgPkg {
  return JSON.parse(readFileSync(path.join(falsegreenPackageRoot(), "package.json"), "utf8")) as FgPkg;
}

function falsegreenVersion(): string {
  return readFgPkg().version;
}

function falsegreenBinPath(): string {
  const root = falsegreenPackageRoot();
  const bin = readFgPkg().bin;
  const rel =
    typeof bin === "string"
      ? bin
      : typeof bin === "object" && bin !== null
        ? bin["falsegreen-js"]
        : undefined;
  if (!rel) throw new Error("falsegreen-js package.json is missing bin.falsegreen-js");
  return path.join(root, rel);
}

/** Build a temp tree of hardlinks (copy fallback) so falsegreen only sees selected test files. */
export function materializeFileTree(repoRoot: string, files: readonly string[], destRoot: string): void {
  for (const rel of files) {
    const src = path.join(repoRoot, rel);
    const dest = path.join(destRoot, ...rel.split("/"));
    mkdirSync(path.dirname(dest), { recursive: true });
    try {
      linkSync(src, dest);
    } catch {
      copyFileSync(src, dest);
    }
  }
}

function runProcess(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0" },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

/**
 * Invoke falsegreen-js on scanRoot; JSON written to reportPath (outside the scanned repo).
 * Exit 0 = clean, 10 = low only, 20 = high present — all are successful scan outcomes.
 */
export async function runFalsegreenJson(
  scanRoot: string,
  reportPath: string,
): Promise<FalsegreenJsonReport> {
  const bin = falsegreenBinPath();
  const args = [bin, ".", "--format", "json", "--output", reportPath];
  const { code, stdout, stderr } = await runProcess(process.execPath, args, scanRoot);
  if (code !== 0 && code !== 10 && code !== 20) {
    throw new Error(`falsegreen-js exited ${code}: ${stderr.trim() || stdout.trim() || "(no output)"}`);
  }
  let raw: string;
  try {
    raw = await readFile(reportPath, "utf8");
  } catch {
    return { findings: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`falsegreen-js JSON report invalid: ${String(err)}`);
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as FalsegreenJsonReport).findings)
  ) {
    throw new Error("falsegreen-js JSON report missing findings[]");
  }
  return parsed as FalsegreenJsonReport;
}

/** Test-role files from the scan set, excluding scratch `.tmp` segments. */
export function selectFalsegreenFiles(ctx: AdapterContext): string[] {
  return ctx
    .filesWithRole("test")
    .filter((f) => !pathHasTmpSegment(f))
    .sort();
}

/** Map a tool path (under temp scan root or absolute) onto a repo-relative POSIX path. */
export function resolveFalsegreenPath(
  toolPath: string,
  scanRootPosix: string,
  repoRootPosix: string,
): string | null {
  let n = toPosix(toolPath);
  const scan = scanRootPosix.replace(/\/$/, "");
  const repo = repoRootPosix.replace(/\/$/, "");
  if (scan && (n === scan || n.startsWith(`${scan}/`))) {
    n = n.slice(scan.length + (n === scan ? 0 : 1));
  } else if (repo && (n === repo || n.startsWith(`${repo}/`))) {
    n = n.slice(repo.length + (n === repo ? 0 : 1));
  }
  n = n.replace(/^\.\//, "");
  if (!n || n.includes("..")) return null;
  return n;
}

export async function runFalsegreenAdapter(ctx: AdapterContext) {
  const files = selectFalsegreenFiles(ctx);
  if (files.length === 0) return [];

  const rawOpts = ctx.config.adapters.falsegreen?.options as Record<string, unknown> | undefined;
  const { allowCodes, includeLow } = parseFalsegreenOptions(rawOpts);
  const source = `falsegreen@${falsegreenVersion()}+dm${ADAPTER_REV}`;

  const work = await mkdtemp(path.join(tmpdir(), "dustmap-falsegreen-"));
  const scanRoot = path.join(work, "src");
  const reportPath = path.join(work, "report.json");
  mkdirSync(scanRoot, { recursive: true });

  try {
    materializeFileTree(ctx.repoRoot, files, scanRoot);
    const report = await runFalsegreenJson(scanRoot, reportPath);
    const scanRootPosix = toPosix(scanRoot);
    const repoRootPosix = toPosix(path.resolve(ctx.repoRoot));
    return normalizeFalsegreenReport(report, {
      allowCodes,
      includeLow,
      source,
      resolvePath: (p) => resolveFalsegreenPath(p, scanRootPosix, repoRootPosix),
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export function falsegreenAdapter(): Adapter {
  return {
    name: "falsegreen",
    version: () => `${falsegreenVersion()}+dm${ADAPTER_REV}`,
    run: runFalsegreenAdapter,
  };
}
