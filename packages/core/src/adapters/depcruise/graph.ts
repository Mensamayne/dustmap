/**
 * Normalize dependency-cruiser module lists into a repo-relative ModuleGraph used by
 * structure signals and (later) diff neighbors / ranking.
 */
import { toPosix } from "../../posix.js";

export type ModuleEdge = {
  from: string;
  to: string;
};

export type ModuleGraph = {
  /** Repo-relative POSIX paths present in the cruise (filtered to scanned sources). */
  nodes: string[];
  /** Local edges between nodes (no node_modules). */
  edges: ModuleEdge[];
  /** Unique import cycles; each entry is an ordered ring of paths (no repeated closer). */
  cycles: string[][];
};

export type CruiseModuleLike = {
  source: string;
  dependencies?: ReadonlyArray<{
    resolved?: string;
    module?: string;
    circular?: boolean;
    cycle?: ReadonlyArray<{ name?: string } | string>;
    dependencyTypes?: readonly string[];
  }>;
};

function isLocalEdge(dep: {
  resolved?: string;
  dependencyTypes?: readonly string[];
}): boolean {
  if (!dep.resolved) return false;
  const types = dep.dependencyTypes ?? [];
  if (types.some((t) => t === "npm" || t === "npm-dev" || t === "core" || t === "unknown")) {
    return false;
  }
  const r = toPosix(dep.resolved);
  if (r.includes("node_modules/")) return false;
  if (r.startsWith("node:")) return false;
  return true;
}

function cycleNames(raw: ReadonlyArray<{ name?: string } | string> | undefined): string[] {
  if (!raw?.length) return [];
  return raw
    .map((c) => (typeof c === "string" ? c : (c.name ?? "")))
    .map((p) => toPosix(p))
    .filter(Boolean);
}

/** Canonical key so A→B→C→A and B→C→A→B collapse to one finding. */
export function cycleKey(ring: readonly string[]): string {
  if (ring.length === 0) return "";
  let nodes = ring.map((p) => toPosix(p));
  if (nodes.length > 1 && nodes[0] === nodes[nodes.length - 1]) {
    nodes = nodes.slice(0, -1);
  }
  if (nodes.length === 0) return "";
  const rotations: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const rot = [...nodes.slice(i), ...nodes.slice(0, i)];
    rotations.push(rot.join("\0"));
    rotations.push([...rot].reverse().join("\0"));
  }
  rotations.sort();
  return rotations[0] ?? "";
}

export function extractCycles(modules: readonly CruiseModuleLike[]): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const mod of modules) {
    for (const dep of mod.dependencies ?? []) {
      if (!dep.circular) continue;
      const ring = cycleNames(dep.cycle);
      if (ring.length < 2) continue;
      const key = cycleKey(ring);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      // Prefer lexicographically smallest rotation for stable locations order.
      let best = ring;
      let bestKey = ring.join("\0");
      for (let i = 1; i < ring.length; i++) {
        const rot = [...ring.slice(i), ...ring.slice(0, i)];
        const k = rot.join("\0");
        if (k < bestKey) {
          best = rot;
          bestKey = k;
        }
      }
      out.push(best.map((p) => toPosix(p)));
    }
  }
  return out.sort((a, b) => a.join("\0").localeCompare(b.join("\0")));
}

/**
 * Build a ModuleGraph from a cruise result, keeping only nodes inside `allowed`
 * (typically scanned source files).
 */
export function buildModuleGraph(
  modules: readonly CruiseModuleLike[],
  allowed: ReadonlySet<string>,
): ModuleGraph {
  const nodes = new Set<string>();
  const edges: ModuleEdge[] = [];
  const edgeKeys = new Set<string>();

  for (const mod of modules) {
    const from = toPosix(mod.source);
    if (!allowed.has(from)) continue;
    nodes.add(from);
    for (const dep of mod.dependencies ?? []) {
      if (!isLocalEdge(dep) || !dep.resolved) continue;
      const to = toPosix(dep.resolved);
      if (!allowed.has(to)) continue;
      nodes.add(to);
      const key = `${from}\0${to}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ from, to });
    }
  }

  const cycles = extractCycles(modules)
    .map((ring) => ring.filter((p) => allowed.has(p)))
    .filter((ring) => ring.length >= 2);

  return {
    nodes: [...nodes].sort(),
    edges,
    cycles,
  };
}

/** Direct import neighbors of seeds (both directions), for diff expansion later. */
export function graphNeighbors(graph: ModuleGraph, seeds: readonly string[]): string[] {
  const seedSet = new Set(seeds.map((s) => toPosix(s)));
  const out = new Set<string>(seedSet);
  for (const e of graph.edges) {
    if (seedSet.has(e.from)) out.add(e.to);
    if (seedSet.has(e.to)) out.add(e.from);
  }
  return [...out].sort();
}
