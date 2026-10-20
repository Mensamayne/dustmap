/**
 * Thin git helpers for commit id, file lists and diff file lists. Paths are POSIX and relative to
 * the scanned directory (which may be a subdirectory of the repository). Failures surface as errors
 * (no silent empty scans), except `isGitWorkTree`, which answers "is this git at all".
 */
import { execFileSync } from "node:child_process";
import { toPosix } from "../posix.js";
import { UserInputError } from "../user-input-error.js";

function git(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 256 * 1024 * 1024,
  }).trimEnd();
}

export function isGitWorkTree(repoRoot: string): boolean {
  try {
    return git(repoRoot, ["rev-parse", "--is-inside-work-tree"]) === "true";
  } catch {
    return false;
  }
}

export function gitHead(repoRoot: string): string {
  try {
    return git(repoRoot, ["rev-parse", "HEAD"]);
  } catch {
    return "uncommitted";
  }
}

/** Tracked files plus untracked files that .gitignore does not hide, relative to repoRoot. */
export function gitListFiles(repoRoot: string): string[] {
  const out = git(repoRoot, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
  if (!out) return [];
  return out.split("\0").filter(Boolean).map(toPosix);
}

/** The diff base does not name a commit in this repository (typo, branch not fetched). */
export class UnknownBaseRefError extends UserInputError {
  readonly code = "unknown_base_ref";
  constructor(readonly baseRef: string) {
    super(`Unknown diff base "${baseRef}": no such commit, branch or tag in this repository (fetched?).`);
    this.name = "UnknownBaseRefError";
  }
}

export function gitDiffNameOnly(repoRoot: string, baseRef: string): string[] {
  try {
    git(repoRoot, ["rev-parse", "--verify", "--quiet", `${baseRef}^{commit}`]);
  } catch {
    throw new UnknownBaseRefError(baseRef);
  }
  let mergeBase: string;
  try {
    mergeBase = git(repoRoot, ["merge-base", baseRef, "HEAD"]);
  } catch {
    // base may be an ancestor commit id already
    mergeBase = baseRef;
  }
  const out = git(repoRoot, ["diff", "--name-only", "--relative", mergeBase]);
  if (!out) return [];
  return out.split(/\r?\n/).filter(Boolean).map(toPosix);
}
