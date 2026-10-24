/**
 * Validation / test split of the private gold refs (CON-12). Files linked by pairs form groups and a
 * whole group goes to one part, so no file — and no function — is seen in both. The part comes from a
 * hash of the group's smallest file key: it depends only on which files are linked, never on labels,
 * so fixing a label never moves pairs between parts. SALT was chosen once (24.10.2026, best per-label
 * balance over 400 salts: every label within 46–54%) and is frozen — changing it reshuffles the test set.
 * The CON-03 per-file `hash % 3` left validation at 18% with 2 `concept` pairs.
 */
import { createHash } from "node:crypto";

const SALT = 298;

/** @param {{ repo?: string, path?: string }} side */
export const fileKey = (side) => `${side.repo ?? ""}:${side.path ?? ""}`;

/**
 * @param {Array<{ id: string, a: { repo?: string, path?: string }, b: { repo?: string, path?: string } }>} rows
 * @returns {Map<string, "validation" | "test">} id → part
 */
export function assignSplits(rows) {
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  for (const r of rows) {
    for (const s of [r.a, r.b]) if (!parent.has(fileKey(s))) parent.set(fileKey(s), fileKey(s));
    parent.set(find(fileKey(r.a)), find(fileKey(r.b)));
  }
  const smallest = new Map();
  for (const k of parent.keys()) {
    const root = find(k);
    if (!smallest.has(root) || k < smallest.get(root)) smallest.set(root, k);
  }
  const out = new Map();
  for (const r of rows) {
    const h = createHash("sha256").update(`gold-split:${SALT}:${smallest.get(find(fileKey(r.a)))}`).digest();
    out.set(r.id, h[0] % 2 === 0 ? "validation" : "test");
  }
  return out;
}

/**
 * Files that appear in both parts — must be empty.
 * @param {Array<{ split: string, a: { repo?: string, path?: string }, b: { repo?: string, path?: string } }>} rows
 * @returns {string[]}
 */
export function filesInBothParts(rows) {
  const seen = new Map();
  for (const r of rows) {
    for (const s of [r.a, r.b]) {
      if (typeof s?.path !== "string") continue;
      const k = fileKey(s);
      if (!seen.has(k)) seen.set(k, new Set());
      seen.get(k).add(r.split);
    }
  }
  return [...seen.entries()].filter(([, parts]) => parts.size > 1).map(([k]) => k);
}
