/**
 * Thin git helpers for commit id and diff file lists. Failures surface as errors (no silent empty scans).
 */
import { execFileSync } from "node:child_process";
import { toPosix } from "../posix.js";

function git(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

export function gitHead(repoRoot: string): string {
  try {
    return git(repoRoot, ["rev-parse", "HEAD"]);
  } catch {
    return "uncommitted";
  }
}

export function gitDiffNameOnly(repoRoot: string, baseRef: string): string[] {
  let mergeBase: string;
  try {
    mergeBase = git(repoRoot, ["merge-base", baseRef, "HEAD"]);
  } catch {
    // base may be an ancestor commit id already
    mergeBase = baseRef;
  }
  const out = git(repoRoot, ["diff", "--name-only", mergeBase]);
  if (!out) return [];
  return out.split(/\r?\n/).filter(Boolean).map(toPosix);
}
