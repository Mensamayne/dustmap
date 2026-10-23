#!/usr/bin/env tsx
/**
 * CON-07 step 0: label EMB-10 same-file sibling candidates (needs-label → pattern|same|different).
 * Reads bodies from the pinned Monorepo-A snapshot; writes back into candidates + a seed slice.
 *
 *   npx tsx tools/emb/gold/label-siblings-con07.mts
 *   npx tsx tools/emb/gold/label-siblings-con07.mts --apply
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repo } from "../gold-data.mts";

const here = path.dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes("--apply");
const candPath = path.join(here, "same-file-siblings-candidates.jsonl");
const seedOut = path.join(here, "same-file-siblings-con07-seed.jsonl");
const deferredPath = path.join(here, "same-file-siblings-deferred.jsonl");

const SNAP = path.resolve(repo, ".tmp/targets/monorepo-a@dbe35aa00cd6/src");

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

function loadBody(s: Side): string | null {
  const file = path.join(SNAP, s.path);
  if (!existsSync(file)) return null;
  const lines = readFileSync(file, "utf8").split(/\n/);
  return lines.slice(s.startLine - 1, s.endLine).join("\n");
}

function normTokens(code: string): Set<string> {
  return new Set((code.match(/[A-Za-z_$][\w$]*/g) ?? []).filter((t) => t.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter || 1);
}

function classify(row: Row, ca: string, cb: string): { label: string; why: string; defer?: boolean } {
  const na = normTokens(ca);
  const nb = normTokens(cb);
  const jac = jaccard(na, nb);
  const nested =
    (row.a.startLine <= row.b.startLine && row.a.endLine >= row.b.endLine) ||
    (row.b.startLine <= row.a.startLine && row.b.endLine >= row.a.endLine);

  if (nested) {
    return { label: "different", why: "CON-07: nested span (inner helper vs outer) — not a sibling pattern" };
  }

  // Near-copy same job: keep out of hard-negatives; rare same for gold.
  if (jac >= 0.97 && (row.sim ?? 0) >= 0.95) {
    return {
      label: "same",
      why: "CON-07: near-identical bodies — likely same responsibility / accidental dup",
      defer: true, // don't flood gold with auto-same; defer manual
    };
  }

  // Default sibling skeleton: same structure, different names/fields → pattern
  if ((row.sim ?? jac) >= 0.55) {
    return {
      label: "pattern",
      why: `CON-07: same-file siblings (sim=${(row.sim ?? jac).toFixed(3)}, tokenJ=${jac.toFixed(3)}); shared skeleton, different job`,
    };
  }

  return {
    label: "different",
    why: `CON-07: low overlap (sim=${(row.sim ?? 0).toFixed(3)}, tokenJ=${jac.toFixed(3)}) — not a useful hard negative`,
    defer: true,
  };
}

const rows: Row[] = readFileSync(candPath, "utf8")
  .trim()
  .split(/\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const needs = rows.filter((r) => r.kindHint === "needs-label");
const seed: Row[] = [];
const deferred: Row[] = [];
const counts: Record<string, number> = {};

for (const row of needs) {
  const ca = loadBody(row.a);
  const cb = loadBody(row.b);
  if (!ca || !cb) {
    deferred.push({
      ...row,
      kindHint: "deferred-missing-body",
      why: "CON-07: body missing on snapshot",
    });
    counts.missing = (counts.missing ?? 0) + 1;
    continue;
  }
  const v = classify(row, ca, cb);
  counts[v.label] = (counts[v.label] ?? 0) + 1;
  const labeled: Row = {
    ...row,
    label: v.label,
    why: v.why,
    kindHint: v.defer ? "deferred-con07" : "labeled-con07",
    source: "CON-07 sibling label",
  };
  if (v.defer) deferred.push(labeled);
  else seed.push(labeled);
}

const report = {
  needs: needs.length,
  seed: seed.length,
  deferred: deferred.length,
  counts,
  apply,
};
console.log(JSON.stringify(report, null, 2));

if (!apply) {
  console.log("Dry-run. Re-run with --apply to write seed + deferred + update candidates.");
  process.exit(0);
}

// Update candidates: replace needs-label rows with labeled/deferred
const byId = new Map([...seed, ...deferred].map((r) => [r.id, r]));
const next = rows.map((r) => byId.get(r.id) ?? r);
writeFileSync(candPath, next.map((r) => JSON.stringify(r)).join("\n") + "\n");
writeFileSync(seedOut, seed.map((r) => JSON.stringify(r)).join("\n") + (seed.length ? "\n" : ""));
writeFileSync(deferredPath, deferred.map((r) => JSON.stringify(r)).join("\n") + (deferred.length ? "\n" : ""));
console.log(`Wrote ${seed.length} → ${path.basename(seedOut)}; ${deferred.length} deferred; candidates updated.`);
