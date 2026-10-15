/**
 * Walk the scanned repo and select files matching include/exclude globs (POSIX paths).
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { minimatch } from "minimatch";
import type { DustmapConfig } from "../config/schema.js";
import { relativePosix, toPosix } from "../posix.js";

function isExcluded(relPosix: string, exclude: readonly string[]): boolean {
  return exclude.some((pattern) => minimatch(relPosix, pattern, { dot: true }));
}

function isIncluded(relPosix: string, include: readonly string[]): boolean {
  return include.some((pattern) => minimatch(relPosix, pattern, { dot: true }));
}

export function collectFiles(repoRoot: string, config: DustmapConfig): string[] {
  const out: string[] = [];

  function walk(absDir: string): void {
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const abs = path.join(absDir, ent.name);
      const rel = relativePosix(repoRoot, abs);
      if (rel === "" || rel.startsWith("..")) continue;
      if (isExcluded(rel, config.exclude) || isExcluded(`${rel}/`, config.exclude)) continue;
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!ent.isFile()) continue;
      if (isIncluded(rel, config.include)) out.push(toPosix(rel));
    }
  }

  walk(repoRoot);
  return out.sort();
}

export function filterExisting(
  repoRoot: string,
  relPaths: readonly string[],
  config: DustmapConfig,
): string[] {
  const out: string[] = [];
  for (const rel of relPaths) {
    const posix = toPosix(rel);
    if (isExcluded(posix, config.exclude)) continue;
    if (!isIncluded(posix, config.include)) continue;
    try {
      if (statSync(path.join(repoRoot, posix)).isFile()) out.push(posix);
    } catch {
      // deleted between diff and walk
    }
  }
  return [...new Set(out)].sort();
}
