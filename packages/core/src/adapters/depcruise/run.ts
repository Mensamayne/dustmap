/**
 * dependency-cruiser adapter entry — cruises the scanned source set (read-only) into a ModuleGraph
 * and emits structure findings (cycles, hubs, layer breaks) via signals/structure.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FindingType } from "@dustmap/contract";
import type { Adapter, AdapterContext } from "../../adapter.js";
import { toPosix } from "../../posix.js";
import { buildStructureFindings } from "../../signals/structure/signals.js";
import { parseStructureThresholds } from "../../signals/structure/thresholds.js";
import { buildModuleGraph, type CruiseModuleLike, type ModuleGraph } from "./graph.js";

const ADAPTER_REV = "1";

type CruiseFn = (
  paths: string[],
  options?: Record<string, unknown>,
) => Promise<{ output: { modules?: CruiseModuleLike[] } | string; exitCode: number }>;

function readPkgNameVersion(dir: string): { name?: string; version: string } | null {
  try {
    return JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as {
      name?: string;
      version: string;
    };
  } catch {
    return null;
  }
}

/** Walk up until package.json name is dependency-cruiser. */
function walkToPackageRoot(startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    const pkg = readPkgNameVersion(dir);
    if (pkg?.name === "dependency-cruiser") return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Locate dependency-cruiser's package root. Prefer `import.meta.resolve` (exports hide package.json);
 * fall back to walking from this file toward node_modules (tsx eval may lack resolve).
 */
function depcruisePackageRoot(): string {
  const resolve = (import.meta as ImportMeta & { resolve?: (s: string) => string }).resolve;
  if (typeof resolve === "function") {
    const fromResolve = walkToPackageRoot(path.dirname(fileURLToPath(resolve("dependency-cruiser"))));
    if (fromResolve) return fromResolve;
  }
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = path.join(dir, "node_modules", "dependency-cruiser");
    const pkg = readPkgNameVersion(candidate);
    if (pkg?.name === "dependency-cruiser") return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not locate dependency-cruiser package root");
}

function depcruiseVersion(): string {
  const pkg = readPkgNameVersion(depcruisePackageRoot());
  if (!pkg?.version) throw new Error("dependency-cruiser package.json missing version");
  return pkg.version;
}

async function loadCruise(): Promise<CruiseFn> {
  const mod = (await import("dependency-cruiser")) as { cruise: CruiseFn };
  return mod.cruise;
}

/**
 * Run dependency-cruiser on the given repo-relative source files. Read-only; never writes into the repo.
 * Exported for DUST-02/09 consumers that need the graph without findings.
 */
export async function cruiseModuleGraph(
  repoRoot: string,
  sourceFiles: readonly string[],
): Promise<ModuleGraph> {
  const allowed = new Set(sourceFiles.map((f) => toPosix(f)));
  if (allowed.size === 0) {
    return { nodes: [], edges: [], cycles: [] };
  }

  const cruise = await loadCruise();
  const files = [...allowed].sort();
  const result = await cruise(files, {
    baseDir: repoRoot,
    doNotFollow: { path: "node_modules" },
    exclude: { path: "node_modules|\\.dustmap" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    // Keep cruise focused on the inventory set; do not walk the whole tree.
    moduleSystems: ["es6", "cjs", "tsd"],
  });

  const output =
    typeof result.output === "string"
      ? (JSON.parse(result.output) as { modules?: CruiseModuleLike[] })
      : result.output;
  return buildModuleGraph(output.modules ?? [], allowed);
}

export async function runDepcruise(ctx: AdapterContext): Promise<FindingType[]> {
  const rawOpts = ctx.config.adapters.depcruise?.options as Record<string, unknown> | undefined;
  const thresholds = parseStructureThresholds(rawOpts);
  const sources = ctx.filesWithRole("source");
  const graph = await cruiseModuleGraph(ctx.repoRoot, sources);
  return buildStructureFindings(graph, ctx.config.layers, thresholds);
}

export function depcruiseAdapter(): Adapter {
  return {
    name: "depcruise",
    version: () => `depcruise@${depcruiseVersion()}+dm${ADAPTER_REV}`,
    run: runDepcruise,
  };
}
