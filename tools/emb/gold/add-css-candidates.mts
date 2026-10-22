#!/usr/bin/env tsx
/**
 * CON-03: add css-css candidate pairs from the pinned Monorepo-A commit via `git show` (read-only).
 * Snapshot `git archive` omitted .css/.scss; live tree at the same SHA still has them.
 *
 *   npx tsx tools/emb/gold/add-css-candidates.mts
 *   → appends to .tmp/con03/candidates.json (target ≥100 css-css, prefer ~180)
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { openOnnxProvider } from "@dustmap/core";
import { extractUnits } from "../../../packages/core/src/semantic/units.ts";
import { repo } from "../gold-data.mts";

const SHA = "dbe35aa00cd63fecf779ad4d48de922de45ce0f5";
const REPO_NAME = "monorepo-a";
const LIVE = process.env.DUSTMAP_TARGET_MONOREPO_A ?? path.resolve(repo, "../monorepo-a");
const OUT = path.join(repo, ".tmp/con03/candidates.json");
const TARGET_PAIRS = 180;

if (!existsSync(LIVE)) {
  console.error(`Brak żywego Monorepo-A: ${LIVE}`);
  process.exit(2);
}

function git(args: string[]): string {
  return execFileSync("git", ["-C", LIVE, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

type Unit = { path: string; startLine: number; endLine: number; name: string; span: string; body: string };

const files = git(["ls-tree", "-r", "--name-only", SHA])
  .split(/\r?\n/)
  .filter((f) => /\.(css|scss)$/i.test(f) && !f.includes("node_modules"));
console.log(`css files at ${SHA.slice(0, 12)}: ${files.length}`);

const units: Unit[] = [];
for (const file of files) {
  let text: string;
  try {
    text = git(["show", `${SHA}:${file}`]);
  } catch {
    continue;
  }
  if (text.length > 400_000) continue;
  const lines = text.split(/\r?\n/);
  for (const u of extractUnits(file, text, { includeFunctions: false, includeFragments: false, includeClasses: false, includeCss: true })) {
    if (u.kind !== "css-rule") continue;
    if (u.endLine - u.startLine > 80) continue;
    const span = lines.slice(u.startLine - 1, u.endLine).join("\n");
    if (span.trim().length < 10) continue;
    units.push({ path: file, startLine: u.startLine, endLine: u.endLine, name: u.name, span, body: u.body });
  }
}
console.log(`css-rule units: ${units.length}`);
if (units.length < 20) {
  console.error("za mało jednostek CSS");
  process.exit(2);
}

let seed = 20261022;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let i = units.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [units[i], units[j]] = [units[j]!, units[i]!];
}
const pool = units.slice(0, Math.min(2500, units.length));

const provider = await openOnnxProvider({ model: "dustmap-same-meaning-private", device: "auto" });
let vecs: Float32Array[];
try {
  console.log(`embedding ${pool.length} css rules…`);
  vecs = await provider.embed(pool.map((u) => u.body));
} finally {
  await provider.release();
}

const candidates = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, "utf8")) as unknown[]) : [];
const taken = new Set(
  (candidates as Array<{ a: { path: string; startLine: number; endLine: number }; b: { path: string; startLine: number; endLine: number } }>).flatMap((c) => [
    [c.a.path, c.a.startLine, c.a.endLine, c.b.path, c.b.startLine, c.b.endLine].join("|"),
    [c.b.path, c.b.startLine, c.b.endLine, c.a.path, c.a.startLine, c.a.endLine].join("|"),
  ]),
);

const ref = (u: Unit) => ({
  repo: REPO_NAME,
  sha: SHA,
  path: u.path,
  startLine: u.startLine,
  endLine: u.endLine,
  name: u.name,
  kind: "css-rule" as const,
  sha256: createHash("sha256").update(u.span).digest("hex"),
});

const bands: Array<[number, number, number]> = [
  [0.7, 1.01, 45],
  [0.5, 0.7, 55],
  [0.3, 0.5, 50],
  [0.15, 0.3, 30],
];

let added = 0;
for (const [lo, hi, n] of bands) {
  let got = 0;
  for (let tries = 0; got < n && tries < 12000; tries++) {
    const i = Math.floor(rnd() * pool.length);
    const inBand: number[] = [];
    for (let j = 0; j < pool.length; j++) {
      if (j === i) continue;
      const s = vecs[i]!.reduce((acc, x, k) => acc + x * vecs[j]![k]!, 0);
      if (s >= lo && s < hi) inBand.push(j);
    }
    if (!inBand.length) continue;
    const j = inBand[Math.floor(rnd() * inBand.length)]!;
    const a = pool[i]!;
    const b = pool[j]!;
    if (a.body === b.body) continue;
    if (a.path === b.path && a.startLine <= b.endLine && b.startLine <= a.endLine) continue;
    const key = [a.path, a.startLine, a.endLine, b.path, b.startLine, b.endLine].join("|");
    if (taken.has(key)) continue;
    taken.add(key);
    const sim = vecs[i]!.reduce((acc, x, k) => acc + x * vecs[j]![k]!, 0);
    candidates.push({
      id: `real:${REPO_NAME}:${createHash("sha1").update(key + "css-css").digest("hex").slice(0, 10)}`,
      pairKind: "css-css",
      band: `${lo}-${Math.min(hi, 1)}`,
      similarity: Number(sim.toFixed(3)),
      a: ref(a),
      b: ref(b),
      codeA: a.span,
      codeB: b.span,
    });
    got++;
    added++;
  }
  console.log(`css-css ${lo}-${hi}: ${got}/${n}`);
}

writeFileSync(OUT, JSON.stringify(candidates, null, 1));
const byKind: Record<string, number> = {};
for (const c of candidates as Array<{ pairKind?: string }>) {
  const k = c.pairKind ?? "?";
  byKind[k] = (byKind[k] ?? 0) + 1;
}
writeFileSync(path.join(repo, ".tmp/con03/counts.json"), JSON.stringify({ total: candidates.length, byPairKind: byKind, cssAdded: added }, null, 2));
console.log(`total=${candidates.length} css-css=${byKind["css-css"] ?? 0} (+${added})`);
if ((byKind["css-css"] ?? 0) < 100) process.exit(2);
