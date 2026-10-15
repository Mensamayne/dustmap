/**
 * jscpd token-mode adapter — runs the jscpd binary (JSON reporter) on a temp hardlink tree of
 * allowed source files so Windows argv limits never clip large repos. Never writes into the
 * scanned repo; never enables auto-fix.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, linkSync, mkdirSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Adapter, AdapterContext } from "../../adapter.js";
import { toPosix } from "../../posix.js";
import { clusterDuplicates, resolveClonePath } from "./cluster.js";
import { parseJscpdNoiseOptions, shouldScanForJscpd } from "./noise.js";
import type { JscpdJsonReport } from "./types.js";

const require = createRequire(import.meta.url);

type JscpdPkg = { name?: string; version: string; bin?: string | Record<string, string> };

function jscpdPackageRoot(): string {
  return path.dirname(require.resolve("jscpd/package.json"));
}

function readJscpdPkg(): JscpdPkg {
  return JSON.parse(readFileSync(path.join(jscpdPackageRoot(), "package.json"), "utf8")) as JscpdPkg;
}

function jscpdVersion(): string {
  return readJscpdPkg().version;
}

function jscpdBinPath(): string {
  const root = jscpdPackageRoot();
  const bin = readJscpdPkg().bin;
  const rel =
    typeof bin === "string" ? bin : typeof bin === "object" && bin !== null ? bin.jscpd : undefined;
  if (!rel) throw new Error("jscpd package.json is missing bin.jscpd");
  return path.join(root, rel);
}

export type JscpdRunOptions = {
  minTokens: number;
  minLines: number;
};

export function parseJscpdRunOptions(raw: Record<string, unknown> | undefined): JscpdRunOptions {
  const src = raw ?? {};
  const minTokens = typeof src.minTokens === "number" && src.minTokens > 0 ? src.minTokens : 50;
  const minLines = typeof src.minLines === "number" && src.minLines > 0 ? src.minLines : 5;
  return { minTokens, minLines };
}

/** Build a temp tree of hardlinks (copy fallback) so jscpd only sees allowed files. */
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

/** Invoke jscpd token mode; JSON written under outputDir (outside the scanned repo). */
export async function runJscpdJson(
  scanRoot: string,
  outputDir: string,
  opts: JscpdRunOptions,
): Promise<JscpdJsonReport> {
  const bin = jscpdBinPath();
  const args = [
    bin,
    "--min-tokens",
    String(opts.minTokens),
    "--min-lines",
    String(opts.minLines),
    "--reporters",
    "json",
    "--output",
    outputDir,
    "--silent",
    "--format",
    "typescript,javascript,tsx,jsx",
    ".",
  ];
  const { code, stdout, stderr } = await runProcess(process.execPath, args, scanRoot);
  // jscpd may exit 0 or 1 when clones exist depending on threshold/exit-code flags.
  if (code !== 0 && code !== 1) {
    throw new Error(`jscpd exited ${code}: ${stderr.trim() || stdout.trim() || "(no output)"}`);
  }
  const reportPath = path.join(outputDir, "jscpd-report.json");
  let raw: string;
  try {
    raw = await readFile(reportPath, "utf8");
  } catch {
    // No duplicates → some builds omit the file; treat as empty.
    return { duplicates: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`jscpd JSON report invalid: ${String(err)}`);
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as JscpdJsonReport).duplicates)
  ) {
    throw new Error("jscpd JSON report missing duplicates[]");
  }
  return parsed as JscpdJsonReport;
}

export async function selectJscpdFiles(ctx: AdapterContext): Promise<string[]> {
  const rawOpts = ctx.config.adapters.jscpd?.options as Record<string, unknown> | undefined;
  const noise = parseJscpdNoiseOptions(rawOpts);
  const out: string[] = [];
  for (const f of ctx.files) {
    const role = ctx.roles.get(f);
    let text: string | undefined;
    try {
      text = await ctx.readFile(f);
    } catch {
      text = undefined;
    }
    if (shouldScanForJscpd(f, role, text, noise)) out.push(f);
  }
  return out.sort();
}

export async function runJscpdAdapter(ctx: AdapterContext) {
  const files = await selectJscpdFiles(ctx);
  if (files.length < 2) return [];

  const rawOpts = ctx.config.adapters.jscpd?.options as Record<string, unknown> | undefined;
  const runOpts = parseJscpdRunOptions(rawOpts);

  const work = await mkdtemp(path.join(tmpdir(), "dustmap-jscpd-"));
  const scanRoot = path.join(work, "src");
  const outputDir = path.join(work, "out");
  mkdirSync(scanRoot, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  try {
    materializeFileTree(ctx.repoRoot, files, scanRoot);
    const report = await runJscpdJson(scanRoot, outputDir, runOpts);
    const scanRootPosix = toPosix(scanRoot);
    const repoRootPosix = toPosix(path.resolve(ctx.repoRoot));
    return clusterDuplicates(report.duplicates, (name) => {
      const stripped = resolveClonePath(name, scanRootPosix);
      // Absolute paths under the real repo (if any) → relative.
      return resolveClonePath(stripped, repoRootPosix);
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Bump when cluster/noise mapping changes so content-hash cache does not serve stale findings. */
const JSCPD_ADAPTER_REV = "2";

export function jscpdAdapter(): Adapter {
  return {
    name: "jscpd",
    version: () => `${jscpdVersion()}+dm${JSCPD_ADAPTER_REV}`,
    run: runJscpdAdapter,
  };
}
