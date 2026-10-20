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
import { listWorkspaceDirs } from "../../init/detect.js";
import { normalizeKnipReport } from "./normalize.js";
import type { KnipJsonReport } from "./types.js";

const require = createRequire(import.meta.url);

const BLOCKED_ROLES = new Set(["generated", "vendored", "minified", "oversized"]);

/**
 * Bump whenever this adapter's config building or normalization changes — part of the cache key,
 * so an upgraded Dustmap never serves findings computed by the old logic (2: per-workspace entries;
 * 3: fingerprints hash the code, not the name; 4: no dead-code findings on fixtures).
 */
const ADAPTER_REV = 4;

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
 * Knip's own default entry patterns. A workspace `entry` list replaces them, so Dustmap repeats them
 * to add its entries on top instead of silently dropping `index.ts` / `src/main.ts` (knip.dev → entry).
 */
const KNIP_DEFAULT_ENTRY = [
  "{index,cli,main}.{js,cjs,mjs,jsx,ts,cts,mts,tsx}",
  "src/{index,cli,main}.{js,cjs,mjs,jsx,ts,cts,mts,tsx}",
];

/** A glob that starts with a wildcard segment matches anywhere — it belongs to every workspace. */
function isLocationFree(pattern: string): boolean {
  return /^(\*\*?|\{)/.test(pattern);
}

/** Longest workspace dir that contains `pattern`'s literal prefix, or "." for the root workspace. */
function ownerWorkspace(pattern: string, workspaces: readonly string[]): string {
  let best = ".";
  for (const ws of workspaces) {
    if (pattern.startsWith(`${ws}/`) && ws.length > (best === "." ? 0 : best.length)) best = ws;
  }
  return best;
}

type KnipWorkspace = { entry: string[]; project: string[] };

/**
 * Build a knip.json body. Dustmap entryPoints + test-role files are graph entries; blocked roles and
 * exclude globs are ignored. Knip evaluates every workspace package separately and reads root-level
 * `entry` / `project` for the root package only, so each pattern goes to the workspace that owns it
 * (path relative to that package); location-free globs go to every workspace (BUG-12).
 */
export function buildKnipConfig(ctx: AdapterContext): Record<string, unknown> {
  const ignore = new Set<string>(ctx.config.exclude);
  for (const f of ctx.files) {
    const role = ctx.roles.get(f);
    if (role && BLOCKED_ROLES.has(role)) ignore.add(f);
  }

  const workspaceDirs = listWorkspaceDirs(ctx.repoRoot);
  const all = [".", ...workspaceDirs];
  const ws = new Map<string, KnipWorkspace>(all.map((w) => [w, { entry: [], project: [] }]));
  const place = (pattern: string, key: keyof KnipWorkspace) => {
    if (isLocationFree(pattern)) {
      for (const w of all) ws.get(w)![key].push(pattern);
      return;
    }
    const owner = ownerWorkspace(pattern, workspaceDirs);
    ws.get(owner)![key].push(owner === "." ? pattern : pattern.slice(owner.length + 1));
  };
  for (const e of new Set([...ctx.config.entryPoints, ...ctx.filesWithRole("test")])) place(e, "entry");
  for (const p of ctx.config.include) place(p, "project");

  const config: Record<string, unknown> = {};
  if (ignore.size > 0) config.ignore = [...ignore].sort();
  const workspaces: Record<string, Record<string, string[]>> = {};
  for (const [dir, { entry, project }] of ws) {
    const body: Record<string, string[]> = {};
    // Empty entry stays omitted so Knip plugins still auto-discover framework routes and package.bin.
    if (entry.length > 0) body.entry = [...KNIP_DEFAULT_ENTRY, ...new Set(entry)].sort();
    if (project.length > 0) body.project = [...new Set(project)];
    if (Object.keys(body).length > 0) workspaces[dir] = body;
  }
  if (workspaceDirs.length === 0) {
    Object.assign(config, workspaces["."] ?? {});
  } else if (Object.keys(workspaces).length > 0) {
    config.workspaces = workspaces;
  }
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

  const fileTexts = new Map<string, string>();
  for (const f of ctx.filesWithRole("source", "test", "fixture")) {
    fileTexts.set(f, await ctx.readFile(f));
  }

  return normalizeKnipReport(report, {
    scannedFiles: new Set(ctx.files),
    roles: ctx.roles,
    fileTexts,
  });
}

export function knipAdapter(): Adapter {
  return {
    name: "knip",
    version: () => `${knipVersion()}+dm${ADAPTER_REV}`,
    run: runKnipAdapter,
  };
}
