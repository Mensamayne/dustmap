/**
 * Persist parsed git log under outputDir so a follow-up `diff` scan does not re-read the full log.
 * Cache key: HEAD + since + massCommitFileLimit.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gitHead } from "../../scan/git.js";
import type { ParsedGitLog } from "./log.js";
import { parseNumstatLog, readGitLog } from "./log.js";
import type { GitSignalThresholds } from "./thresholds.js";

export type GitLogCacheStats = {
  /** True when the log was loaded from disk cache. */
  hit: boolean;
  /** True when git log was executed. */
  ranGitLog: boolean;
};

function cacheKey(head: string, thresholds: GitSignalThresholds): string {
  return createHash("sha256")
    .update(`${head}\0${thresholds.since}\0${thresholds.massCommitFileLimit}`, "utf8")
    .digest("hex")
    .slice(0, 24);
}

export function gitLogCachePath(outputDirAbs: string, key: string): string {
  return path.join(outputDirAbs, "cache", "git-history", `${key}.json`);
}

/**
 * Load parsed history from cache when present and fresh for this HEAD/options; otherwise run git log
 * once and store the result. Always read-only against the git repo.
 */
export function loadGitLogCached(
  repoRoot: string,
  outputDirAbs: string,
  thresholds: GitSignalThresholds,
): { log: ParsedGitLog; stats: GitLogCacheStats } {
  const head = gitHead(repoRoot);
  const key = cacheKey(head, thresholds);
  const file = gitLogCachePath(outputDirAbs, key);
  if (existsSync(file)) {
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as ParsedGitLog;
      if (Array.isArray(raw.commits)) {
        return { log: raw, stats: { hit: true, ranGitLog: false } };
      }
    } catch {
      /* rebuild */
    }
  }

  const log = readGitLog(repoRoot, {
    since: thresholds.since,
    massCommitFileLimit: thresholds.massCommitFileLimit,
  });
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(log)}\n`, "utf8");
  return { log, stats: { hit: false, ranGitLog: true } };
}

/** Test helper: write a pre-parsed log into the cache as if git had been run. */
export function seedGitLogCache(
  outputDirAbs: string,
  repoRoot: string,
  thresholds: GitSignalThresholds,
  log: ParsedGitLog,
): string {
  const key = cacheKey(gitHead(repoRoot), thresholds);
  const file = gitLogCachePath(outputDirAbs, key);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(log)}\n`, "utf8");
  return file;
}

/** Re-parse raw numstat text (for unit tests without git). */
export function parseLogForTests(raw: string, massLimit: number): ParsedGitLog {
  return parseNumstatLog(raw, massLimit);
}
