#!/usr/bin/env tsx
/**
 * Top up .tmp/con03/candidates.json past 1200 without a full re-embed of all pools.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { extractUnits, loadConfig, openOnnxProvider, takeInventory } from "@dustmap/core";
import { repo } from "../gold-data.mts";

const file = path.join(repo, ".tmp/con03/candidates.json");
const candidates = JSON.parse(readFileSync(file, "utf8")) as Array<{
  a: { path: string; startLine: number; endLine: number };
  b: { path: string; startLine: number; endLine: number };
}>;
const need = Math.max(0, 1210 - candidates.length);
console.log(`have ${candidates.length}, need +${need}`);
if (need === 0) process.exit(0);

const taken = new Set(
  candidates.flatMap((c) => [
    [c.a.path, c.a.startLine, c.a.endLine, c.b.path, c.b.startLine, c.b.endLine].join("|"),
    [c.b.path, c.b.startLine, c.b.endLine, c.a.path, c.a.startLine, c.a.endLine].join("|"),
  ]),
);

const t = { repo: "monorepo-a", sha: "dbe35aa00cd63fecf779ad4d48de922de45ce0f5", config: "tools/targets/monorepo-a.dustmap.config.json" };
const root = path.join(repo, ".tmp/targets", `${t.repo}@${t.sha.slice(0, 12)}`, "src");
const { config } = loadConfig(root, path.join(repo, t.config));
const inv = takeInventory(root, config, "full");
type U = { path: string; startLine: number; endLine: number; name: string; span: string; body: string };
const fns: U[] = [];
for (const f of inv.files) {
  if (inv.roles.get(f) !== "source") continue;
  const text = inv.contents.get(f) ?? "";
  const lines = text.split(/\r?\n/);
  for (const u of extractUnits(f, text, { minTokens: 20, includeFragments: false, includeClasses: false, includeCss: false })) {
    if (u.kind !== "function" || u.endLine - u.startLine > 120) continue;
    fns.push({ path: f, startLine: u.startLine, endLine: u.endLine, name: u.name, span: lines.slice(u.startLine - 1, u.endLine).join("\n"), body: u.body });
  }
}
let seed = 99;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
for (let i = fns.length - 1; i > 0; i--) {
  const j = Math.floor(rnd() * (i + 1));
  [fns[i], fns[j]] = [fns[j]!, fns[i]!];
}
const pool = fns.slice(0, 1500);
console.log(`embedding ${pool.length} functions…`);
const provider = await openOnnxProvider({ model: "dustmap-same-meaning-private", device: "auto" });
let vecs: Float32Array[];
try {
  vecs = await provider.embed(pool.map((f) => f.body));
} finally {
  await provider.release();
}
const ref = (u: U) => ({
  repo: t.repo,
  sha: t.sha,
  path: u.path,
  startLine: u.startLine,
  endLine: u.endLine,
  name: u.name,
  kind: "function" as const,
  sha256: createHash("sha256").update(u.span).digest("hex"),
});
let added = 0;
for (let tries = 0; added < need && tries < 30000; tries++) {
  const i = Math.floor(rnd() * pool.length);
  const j = Math.floor(rnd() * pool.length);
  if (i === j) continue;
  const sim = vecs[i]!.reduce((s, x, k) => s + x * vecs[j]![k]!, 0);
  if (sim < 0.25 || sim >= 0.9) continue;
  const a = pool[i]!;
  const b = pool[j]!;
  if (a.path === b.path && a.startLine <= b.endLine && b.startLine <= a.endLine) continue;
  if (a.body === b.body) continue;
  const key = [a.path, a.startLine, a.endLine, b.path, b.startLine, b.endLine].join("|");
  if (taken.has(key)) continue;
  taken.add(key);
  taken.add([b.path, b.startLine, b.endLine, a.path, a.startLine, a.endLine].join("|"));
  candidates.push({
    id: `real:${t.repo}:${createHash("sha1").update(key + "topup").digest("hex").slice(0, 10)}`,
    pairKind: "fn-fn",
    band: "topup",
    similarity: Number(sim.toFixed(3)),
    a: ref(a),
    b: ref(b),
    codeA: a.span,
    codeB: b.span,
  } as never);
  added++;
}
writeFileSync(file, JSON.stringify(candidates, null, 1));
writeFileSync(path.join(repo, ".tmp/con03/counts.json"), JSON.stringify({ total: candidates.length, addedTopup: added }, null, 2));
console.log(`done: total=${candidates.length} added=${added}`);
if (candidates.length < 1200) process.exit(2);
