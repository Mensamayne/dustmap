/**
 * Merge accepted same-file sibling pairs into real-refs.jsonl (gold holdout).
 *
 * Accepted (default), all marked `trap: true` (reported apart from AP and calibration, CON-12):
 *   - every row from same-file-siblings-seed.jsonl (hand-reviewed)
 *   - candidates labelled in CON-07
 *
 * Never accepted: kindHint nested-false-alarm (a helper inside its outer function — the scan drops
 * such pairs, CON-12).
 *
 * Not accepted until labeled:
 *   - candidates with kindHint needs-label (proposed pattern only)
 *
 *   npx tsx tools/emb/gold/merge-same-file-siblings.mts           # dry-run
 *   npx tsx tools/emb/gold/merge-same-file-siblings.mts --apply   # write real-refs.jsonl
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assignSplits } from "./file-split.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes("--apply");
const includeProposed = process.argv.includes("--include-proposed-pattern");

const SOURCE = "EMB-10 same-file siblings";
const seedPath = path.join(here, "same-file-siblings-seed.jsonl");
const seedCon07Path = path.join(here, "same-file-siblings-con07-seed.jsonl");
const candPath = path.join(here, "same-file-siblings-candidates.jsonl");
const refsPath = path.join(here, "real-refs.jsonl");

type Side = {
  repo: string;
  sha: string;
  path: string;
  startLine: number;
  endLine: number;
  name: string;
  kind: string;
  sha256: string;
};

type Row = {
  id: string;
  label: string;
  split: string;
  source: string;
  sim?: number;
  why: string;
  kindHint?: string;
  a: Side;
  b: Side;
};

function jsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .trim()
    .split(/\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

function sideKey(s: Side): string {
  return `${s.path}\0${s.startLine}\0${s.endLine}\0${s.name}`;
}

/** Unordered pair of spans — same gold pair regardless of a/b order. */
function pairKey(a: Side, b: Side): string {
  const x = sideKey(a);
  const y = sideKey(b);
  return x < y ? `${x}\n${y}` : `${y}\n${x}`;
}

function requireSha256(row: Row, at: string): void {
  for (const s of [row.a, row.b]) {
    if (typeof s.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(s.sha256)) {
      throw new Error(`${at}: missing sha256 on ${s.name}`);
    }
  }
}

function toGoldRow(row: Row, source: string): Row {
  requireSha256(row, row.id);
  const { kindHint: _drop, ...rest } = row;
  return {
    ...rest,
    id: row.id.startsWith("sibling:") ? row.id : `sibling:${row.id}`,
    source,
    // Placeholder: the whole set is re-split on write (file groups, CON-12).
    split: row.split ?? "test",
    // Harvested from a model's own top hits: reported apart from AP and calibration (CON-12).
    trap: true,
  };
}

const seed = [...jsonl<Row>(seedPath), ...jsonl<Row>(seedCon07Path)];
const candidates = jsonl<Row>(candPath);
const existing = jsonl<Row>(refsPath);

const existingKeys = new Set(existing.map((r) => pairKey(r.a, r.b)));
const existingIds = new Set(existing.map((r) => r.id));

const accepted: Row[] = [];
const seen = new Set<string>();

function take(row: Row, source: string, bucket: string): void {
  const key = pairKey(row.a, row.b);
  if (seen.has(key) || existingKeys.has(key)) return;
  if (existingIds.has(row.id) || existingIds.has(`sibling:${row.id}`)) return;
  seen.add(key);
  accepted.push(toGoldRow(row, source));
  counts[bucket] = (counts[bucket] ?? 0) + 1;
}

const counts: Record<string, number> = {};

// Hand review wins: insert first.
for (const r of seed) take(r, SOURCE, "seed");

for (const r of candidates) {
  // Nested spans (a helper inside its outer function) never enter the gold: the scan drops them
  // (isNestedSpanPair) and textually the outer one contains the inner one (CON-12).
  if (r.kindHint === "nested-false-alarm") continue;
  if (r.kindHint === "labeled-con07") take(r, "CON-07 sibling label", "labeled-con07");
  else if (r.kindHint === "needs-label" && includeProposed) take(r, SOURCE, "proposed-pattern");
}

const skippedNeedsLabel = candidates.filter((r) => r.kindHint === "needs-label").length;
const skippedDup = seed.length - accepted.length;

const byLabel: Record<string, number> = {};
for (const r of accepted) byLabel[r.label] = (byLabel[r.label] ?? 0) + 1;

const report = {
  mode: apply ? "apply" : "dry-run",
  accepted: accepted.length,
  bySourceBucket: counts,
  byLabel,
  skippedNeedsLabel: includeProposed ? 0 : skippedNeedsLabel,
  skippedDupOrAlreadyInGold: Math.max(0, skippedDup),
  realRefsBefore: existing.length,
  realRefsAfter: existing.length + accepted.length,
};

console.log(JSON.stringify(report, null, 2));

if (!apply) {
  console.log("Dry-run OK. Re-run with --apply to append into real-refs.jsonl.");
  if (!includeProposed) {
    console.log(`Left in candidates (needs-label): ${skippedNeedsLabel} — label in CON-07, then re-run merge.`);
  }
  process.exit(0);
}

if (accepted.length === 0) {
  console.log("Nothing to merge.");
  process.exit(0);
}

const merged = [...existing, ...accepted];
const parts = assignSplits(merged);
const out = merged.map((r) => ({ ...r, split: parts.get(r.id) ?? r.split }));
writeFileSync(refsPath, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`Wrote ${accepted.length} new rows → real-refs.jsonl (total ${out.length}).`);
