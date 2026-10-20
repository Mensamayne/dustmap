#!/usr/bin/env node
/**
 * Build tools/emb/gold/public.jsonl from the hand-written families. Deterministic: same input →
 * byte-identical output, so `git diff` shows every gold change. Each pair gets a stable split:
 * `validation` (~1/3, for calibration in EMB-09) or `test` (held out — never trained on, never tuned on).
 *
 *   node tools/emb/gold/build-public.mjs          write public.jsonl
 *   node tools/emb/gold/build-public.mjs --check  exit 1 when public.jsonl is out of date
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { differentPairs } from "./pairs-different.mjs";
import { patternFamilies } from "./families-pattern.mjs";
import { sameFamilies } from "./families-same.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.join(here, "public.jsonl");

const NAME = /(?:function\*?\s+|const\s+|class\s+|\.command\(")([A-Za-z_$][\w$]*)|router\.(\w+)\("([^"]+)"|bus\.on\("([^"]+)"/;

function side(code) {
  const m = NAME.exec(code);
  const name = m ? (m[1] ?? (m[2] ? m[2] + " " + m[3] : m[4])) : "anonymous";
  return { name, code };
}

function split(id) {
  return createHash("sha1").update(id).digest()[0] % 3 === 0 ? "validation" : "test";
}

function pair(id, label, source, why, a, b) {
  return { id, label, split: split(id), source, why, a: side(a), b: side(b) };
}

const pairs = [];
for (const f of sameFamilies) {
  const v = f.variants;
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    pairs.push(pair(`same:${f.id}:${i}-${j}`, "same", "handwritten", `to samo zadanie „${f.id}”, inny zapis`, v[i], v[j]));
  }
}
for (const f of patternFamilies) {
  const v = f.variants;
  for (const [i, j] of [[0, 1], [1, 2], [2, 3], [0, 3]]) {
    pairs.push(pair(`pattern:${f.id}:${i}-${j}`, "pattern", "handwritten", `wspólny szkielet „${f.id}”, inna logika`, v[i], v[j]));
  }
}
for (const d of differentPairs) {
  pairs.push(pair(`different:${d.id}`, "different", "handwritten", d.why, d.a, d.b));
}
// Easy negatives: unrelated tasks, deterministic spread over families and variants.
const pool = [
  ...sameFamilies.map((f) => ({ id: f.id, variants: f.variants })),
  ...patternFamilies.map((f) => ({ id: f.id, variants: f.variants })),
];
for (let i = 0; i < 24; i++) {
  const x = pool[i % pool.length];
  const y = pool[(i * 7 + 5) % pool.length];
  if (x.id === y.id) throw new Error(`cross pair ${i} hits one family`);
  const a = x.variants[i % x.variants.length];
  const b = y.variants[(i + 1) % y.variants.length];
  pairs.push(pair(`different:cross:${x.id}~${y.id}`, "different", "handwritten-cross", "niezwiązane zadania", a, b));
}

const body = `${pairs.map((p) => JSON.stringify(p)).join("\n")}\n`;
if (process.argv.includes("--check")) {
  const current = (() => {
    try {
      return readFileSync(outFile, "utf8");
    } catch {
      return "";
    }
  })();
  if (current.replace(/\r\n/g, "\n") !== body) {
    console.error("public.jsonl is out of date — run node tools/emb/gold/build-public.mjs");
    process.exit(1);
  }
  console.log(`public.jsonl up to date (${pairs.length} pairs)`);
} else {
  writeFileSync(outFile, body);
  const by = (l) => pairs.filter((p) => p.label === l).length;
  console.log(`public.jsonl: ${pairs.length} pairs · same ${by("same")} · pattern ${by("pattern")} · different ${by("different")}`);
}
