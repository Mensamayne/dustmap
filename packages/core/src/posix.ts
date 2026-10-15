/**
 * Path helpers: everything the core writes into reports stays POSIX and repo-relative.
 */
import path from "node:path";

export function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Absolute path → POSIX path relative to root (no leading `./`). */
export function relativePosix(fromAbs: string, toAbs: string): string {
  return toPosix(path.relative(fromAbs, toAbs)).replace(/^\.\//, "");
}

export function joinPosix(...parts: string[]): string {
  return toPosix(path.join(...parts));
}
