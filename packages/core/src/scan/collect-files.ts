/**
 * Select the scanned repo's files matching include/exclude globs (POSIX paths).
 * Inside a git work tree the candidate list comes from git (tracked + untracked-not-ignored),
 * so everything .gitignore hides (build caches, temp dirs, node_modules) never reaches adapters.
 * Outside git it falls back to walking the disk with `exclude` only.
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { Minimatch } from "minimatch";
import type { DustmapConfig } from "../config/schema.js";
import { relativePosix, toPosix } from "../posix.js";
import { gitListFiles, isGitWorkTree } from "./git.js";

type Matchers = { include: Minimatch[]; exclude: Minimatch[] };

function compile(config: DustmapConfig): Matchers {
  const opts = { dot: true };
  return {
    include: config.include.map((p) => new Minimatch(p, opts)),
    exclude: config.exclude.map((p) => new Minimatch(p, opts)),
  };
}

function isExcluded(relPosix: string, m: Matchers): boolean {
  return m.exclude.some((mm) => mm.match(relPosix));
}

function isIncluded(relPosix: string, m: Matchers): boolean {
  return m.include.some((mm) => mm.match(relPosix));
}

function isFile(abs: string): boolean {
  try {
    return statSync(abs).isFile();
  } catch {
    return false;
  }
}

function walkDisk(repoRoot: string, m: Matchers): string[] {
  const out: string[] = [];
  function walk(absDir: string): void {
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name === ".git") continue;
      const abs = path.join(absDir, ent.name);
      const rel = relativePosix(repoRoot, abs);
      if (rel === "" || rel.startsWith("..")) continue;
      if (isExcluded(rel, m) || isExcluded(`${rel}/`, m)) continue;
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      if (ent.isFile() && isIncluded(rel, m)) out.push(toPosix(rel));
    }
  }
  walk(repoRoot);
  return out;
}

export function collectFiles(repoRoot: string, config: DustmapConfig): string[] {
  const m = compile(config);
  if (!isGitWorkTree(repoRoot)) return walkDisk(repoRoot, m).sort();

  const out: string[] = [];
  for (const rel of gitListFiles(repoRoot)) {
    if (isExcluded(rel, m) || !isIncluded(rel, m)) continue;
    // Tracked but deleted on disk (not yet committed) is not scannable.
    if (isFile(path.join(repoRoot, rel))) out.push(rel);
  }
  return [...new Set(out)].sort();
}

export function filterExisting(
  repoRoot: string,
  relPaths: readonly string[],
  config: DustmapConfig,
): string[] {
  const m = compile(config);
  const out: string[] = [];
  for (const rel of relPaths) {
    const posix = toPosix(rel);
    if (isExcluded(posix, m) || !isIncluded(posix, m)) continue;
    if (isFile(path.join(repoRoot, posix))) out.push(posix);
  }
  return [...new Set(out)].sort();
}
