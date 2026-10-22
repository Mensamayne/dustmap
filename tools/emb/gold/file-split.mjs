/**
 * CON-03: assign validation/test by stable per-file hash (not per pair).
 * A pair whose sides land in different file buckets always goes to `test`.
 */
import { createHash } from "node:crypto";

/** @param {string} filePath repo-relative path */
export function fileBucket(filePath) {
  const h = createHash("sha256").update(filePath).digest();
  return h[0] % 3 === 0 ? "validation" : "test";
}

/**
 * @param {string} pathA
 * @param {string} pathB
 * @returns {"validation"|"test"}
 */
export function pairSplitFromPaths(pathA, pathB) {
  const a = fileBucket(pathA);
  const b = fileBucket(pathB);
  return a === b ? a : "test";
}

/**
 * Expected split for a private ref row with a.path / b.path.
 * @param {{ a?: { path?: string }, b?: { path?: string } }} row
 */
export function expectedSplit(row) {
  const pa = row?.a?.path;
  const pb = row?.b?.path;
  if (typeof pa !== "string" || typeof pb !== "string") return null;
  return pairSplitFromPaths(pa, pb);
}
