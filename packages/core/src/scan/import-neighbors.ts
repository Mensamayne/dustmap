/**
 * Expand a file set with direct relative import neighbors (TS/JS). Enough for diff mode without depcruise.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { joinPosix, toPosix } from "../posix.js";

const IMPORT_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"\n]+from\s+)?['"](\.[^'"]+)['"]|require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

const CODE_EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

function resolveRelative(fromFile: string, spec: string, repoRoot: string): string | null {
  const fromDir = path.posix.dirname(fromFile);
  const joined = joinPosix(fromDir, spec);
  const candidates = [
    joined,
    ...CODE_EXT.map((e) => joined + e),
    ...CODE_EXT.map((e) => joinPosix(joined, `index${e}`)),
  ];
  for (const cand of candidates) {
    const abs = path.join(repoRoot, cand);
    if (existsSync(abs)) return toPosix(cand);
  }
  return null;
}

function importsOf(repoRoot: string, file: string): string[] {
  const abs = path.join(repoRoot, file);
  let text: string;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2];
    if (!spec) continue;
    const resolved = resolveRelative(file, spec, repoRoot);
    if (resolved) found.push(resolved);
  }
  return found;
}

/** One-hop neighbors: files that the seed set imports (relative only). */
export function expandImportNeighbors(repoRoot: string, seeds: readonly string[]): string[] {
  const out = new Set(seeds.map(toPosix));
  for (const file of seeds) {
    for (const n of importsOf(repoRoot, toPosix(file))) out.add(n);
  }
  return [...out].sort();
}
