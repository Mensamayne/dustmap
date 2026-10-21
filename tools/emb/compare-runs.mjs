#!/usr/bin/env node
/**
 * Compare meter runs (.tmp/emb/run-*.json — ids and scores only) on the held-out test split:
 * AP, AP on the pairs a reference run actually scored, recall at fixed precision, and a paired
 * bootstrap of AP against a challenger. The latest run per provider/model wins.
 *
 *   node tools/emb/compare-runs.mjs [--challenger "<model label>"] [--reference "<label>"] [--boot 2000]
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { averagePrecision, recallAtPrecision } from "./metrics.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(repo, ".tmp/emb");
const argv = process.argv.slice(2);
const arg = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);

const runs = {};
for (const f of readdirSync(dir).filter((f) => f.startsWith("run-")).sort()) {
  const r = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
  runs[r.provider === "current" ? `jscpd · ${r.model}` : r.model] = r.raw.filter((p) => p.split === "test");
}
const names = Object.keys(runs);
const reference = arg("reference", names.find((n) => n.startsWith("jscpd")));
const challenger = arg("challenger", names[names.length - 1]);
const scoredByRef = new Set((runs[reference] ?? []).filter((p) => p.score !== null).map((p) => p.id));

const pct = (x) => `${Math.round(x * 100)}%`;
console.log(`Zbiór test · odniesienie: ${reference} (ocenił ${scoredByRef.size} par) · pretendent: ${challenger}\n`);
console.log("model | AP | AP na parach odniesienia | wykrywalność @precyzja≥0,90 | ≥0,75");
for (const n of names) {
  const t = runs[n];
  const sub = t.filter((p) => scoredByRef.has(p.id));
  const r90 = recallAtPrecision(t, 0.9);
  const r75 = recallAtPrecision(t, 0.75);
  console.log(`${n} | ${averagePrecision(t).toFixed(3)} | ${averagePrecision(sub).toFixed(3)} | ${pct(r90.recall)} | ${pct(r75.recall)}${r75.threshold !== null ? ` (próg ${r75.threshold.toFixed(2)})` : ""}`);
}

// Paired bootstrap: resample pair ids with replacement; every model is scored on the same resample.
const B = Number(arg("boot", "2000"));
const ids = runs[challenger].map((p) => p.id);
const byId = Object.fromEntries(names.map((n) => [n, Object.fromEntries(runs[n].map((p) => [p.id, p]))]));
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const samples = Object.fromEntries(names.map((n) => [n, []]));
const wins = Object.fromEntries(names.map((n) => [n, 0]));
for (let b = 0; b < B; b++) {
  const pick = Array.from({ length: ids.length }, () => ids[Math.floor(rnd() * ids.length)]);
  const ap = Object.fromEntries(names.map((n) => [n, averagePrecision(pick.map((id) => byId[n][id]))]));
  for (const n of names) {
    samples[n].push(ap[n]);
    if (ap[challenger] > ap[n]) wins[n]++;
  }
}
console.log(`\nBootstrap (${B} losowań par ze zwracaniem):`);
for (const n of names) {
  const s = samples[n].sort((a, b) => a - b);
  console.log(`${n}: AP 95% ${s[Math.floor(B * 0.025)].toFixed(3)}–${s[Math.floor(B * 0.975)].toFixed(3)}${n === challenger ? "" : ` · ${challenger} lepszy w ${((100 * wins[n]) / B).toFixed(1)}%`}`);
}
