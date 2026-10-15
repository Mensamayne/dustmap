/**
 * Knip dead-code adapter — runs Knip as a dependency (CLI, JSON reporter), never --fix, and
 * never writes into the scanned repo. Temp knip config lives under os.tmpdir only.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Adapter, AdapterContext } from "../../adapter.js";
import { normalizeKnipReport } from "./normalize.js";
import type { KnipJsonReport } from "./types.js";

const require = createRequire(import.meta.url);

const BLOCKED_ROLES = new Set(["generated", "vendored", "minified", "oversized"]);

type KnipPkg = { name?: string; version: string; bin?: string | Record<string, string> };

/** Walk up from the resolved `knip` entry to its package root (exports block package.json subpath). */
function knipPackageRoot(): string {
  let dir = path.dirname(require.resolve("knip"));
  for (;;) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as KnipPkg;
      if (pkg.name === "knip") return dir;
    } catch {
      /* keep walking */
    }
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("Could not locate knip package root");
    dir = parent;
  }
}

function readKnipPkg(): KnipPkg {
  return JSON.parse(readFileSync(path.join(knipPackageRoot(), "package.json"), "utf8")) as KnipPkg;
}

function knipVersion(): string {
  return readKnipPkg().version;
}

function knipBinPath(): string {
  const root = knipPackageRoot();
  const bin = readKnipPkg().bin;
  const rel =
    typeof bin === "string" ? bin : typeof bin === "object" && bin !== null ? bin.knip : undefined;
  if (!rel) throw new Error("knip package.json is missing bin.knip");
  return path.join(root, rel);
}

/**
 * Build a knip.json body: Dustmap entryPoints + test-role files as graph entries; ignore blocked
 * roles and Dustmap exclude globs. Empty entry list is omitted so Knip plugins still auto-discover
 * framework routes and package.bin.
 */
export function buildKnipConfig(ctx: AdapterContext): Record<string, unknown> {
  const entries = new Set<string>([
    ...ctx.config.entryPoints,
    ...ctx.filesWithRole("test"),
  ]);

  const ignore = new Set<string>(ctx.config.exclude);
  for (const f of ctx.files) {
    const role = ctx.roles.get(f);
    if (role && BLOCKED_ROLES.has(role)) ignore.add(f);
  }

  const config: Record<string, unknown> = {};
  if (entries.size > 0) config.entry = [...entries].sort();
  if (ignore.size > 0) config.ignore = [...ignore].sort();
  if (ctx.config.include.length > 0) config.project = [...ctx.config.include];
  return config;
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

/** Invoke Knip CLI with `--reporter json`; exit code 1 with issues is success for us. */
export async function runKnipJson(
  repoRoot: string,
  knipConfig: Record<string, unknown>,
): Promise<KnipJsonReport> {
  const dir = await mkdtemp(path.join(tmpdir(), "dustmap-knip-"));
  const configPath = path.join(dir, "knip.json");
  try {
    await writeFile(configPath, `${JSON.stringify(knipConfig, null, 2)}\n`, "utf8");
    const { code, stdout, stderr } = await runProcess(
      process.execPath,
      [knipBinPath(), "--reporter", "json", "--no-progress", "--config", configPath],
      repoRoot,
    );
    // Knip exits 1 when it found issues; 0 when clean. Other codes are failures.
    if (code !== 0 && code !== 1) {
      throw new Error(`knip exited ${code}: ${stderr.trim() || stdout.trim() || "(no output)"}`);
    }
    const trimmed = stdout.trim();
    if (!trimmed) {
      return { issues: [] };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      throw new Error(
        `knip JSON reporter returned invalid JSON: ${String(err)}; stderr=${stderr.slice(0, 500)}`,
      );
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as KnipJsonReport).issues)
    ) {
      throw new Error("knip JSON reporter payload missing issues[]");
    }
    return parsed as KnipJsonReport;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function runKnipAdapter(ctx: AdapterContext) {
  const knipConfig = buildKnipConfig(ctx);
  const report = await runKnipJson(ctx.repoRoot, knipConfig);

  const mentionFiles = ctx.filesWithRole("source", "test", "fixture");
  const mentionTexts: string[] = [];
  for (const f of mentionFiles) {
    mentionTexts.push(await ctx.readFile(f));
  }

  return normalizeKnipReport(report, {
    scannedFiles: new Set(ctx.files),
    roles: ctx.roles,
    mentionTexts,
  });
}

export function knipAdapter(): Adapter {
  return {
    name: "knip",
    version: knipVersion,
    run: runKnipAdapter,
  };
}
