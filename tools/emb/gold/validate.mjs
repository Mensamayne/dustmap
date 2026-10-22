#!/usr/bin/env node
/**
 * Validate the EMB/CON gold set: public.jsonl (pairs with code) and private reference files
 * (private-refs.jsonl from DUST-15, real-refs.jsonl from EMB-12/CON-01 — references only, never code).
 * Rules: five labels (same/contains/concept/pattern/different), `larger` required for contains,
 * known splits, unique ids, no code in private refs, sane line ranges, minimum sizes from EMB-01
 * (≥150 pairs, ≥40 positive-ish `same`, ≥40 `pattern`), public.jsonl in sync with its sources.
 * `--selftest` plants defects and requires each to be caught.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectedSplit } from "./file-split.mjs";

const PRIVATE_REF_FILES = ["private-refs.jsonl", "real-refs.jsonl"];

const here = path.dirname(fileURLToPath(import.meta.url));
const LABELS = new Set(["same", "contains", "concept", "pattern", "different"]);
const SPLITS = new Set(["validation", "test"]);
const SHA = /^[0-9a-f]{40}$/;
const LARGER = new Set(["a", "b"]);

function parseJsonl(text, file) {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch {
        throw new Error(`${file}:${i + 1}: invalid JSON`);
      }
    });
}

function hasCodeKey(value) {
  if (Array.isArray(value)) return value.some(hasCodeKey);
  if (value && typeof value === "object") return Object.entries(value).some(([k, v]) => k === "code" || k === "text" || hasCodeKey(v));
  return false;
}

/** → list of problems (empty = valid). */
export function validateGold(pub, priv, { minTotal = 150, minSame = 40, minPattern = 40 } = {}) {
  const bad = [];
  const ids = new Set();
  for (const [kind, rows] of [["public", pub], ["private", priv]]) {
    for (const r of rows) {
      const at = `${kind}:${r.id ?? "?"}`;
      if (typeof r.id !== "string" || !r.id) bad.push(`${at}: brak id`);
      else if (ids.has(r.id)) bad.push(`${at}: zdublowane id`);
      ids.add(r.id);
      if (!LABELS.has(r.label)) bad.push(`${at}: etykieta ${JSON.stringify(r.label)}`);
      if (!SPLITS.has(r.split)) bad.push(`${at}: część ${JSON.stringify(r.split)}`);
      if (r.label === "contains") {
        if (!LARGER.has(r.larger)) bad.push(`${at}: contains wymaga larger "a"|"b" (jest ${JSON.stringify(r.larger)})`);
      } else if (r.larger != null && r.larger !== undefined) {
        bad.push(`${at}: larger tylko przy contains (jest ${JSON.stringify(r.larger)})`);
      }
      for (const s of [r.a, r.b]) {
        if (!s || typeof s !== "object") {
          bad.push(`${at}: brak strony pary`);
          continue;
        }
        if (kind === "public" && (typeof s.code !== "string" || s.code.trim().length < 20)) bad.push(`${at}: brak kodu`);
        if (kind === "private") {
          if (!SHA.test(s.sha ?? "")) bad.push(`${at}: zły sha`);
          if (typeof s.path !== "string" || s.path.includes("\\") || s.path.startsWith("/")) bad.push(`${at}: zła ścieżka`);
          if (!(Number.isInteger(s.startLine) && Number.isInteger(s.endLine) && s.startLine >= 1 && s.endLine >= s.startLine)) {
            bad.push(`${at}: zły zakres linii`);
          }
        }
      }
      if (kind === "private" && hasCodeKey(r)) bad.push(`${at}: kod w pliku prywatnym — dozwolone tylko odnośniki`);
      // CON-03: private rows with paths must use per-file hash split (no cross-bucket leak into validation)
      if (kind === "private") {
        const want = expectedSplit(r);
        if (want && r.split !== want) {
          bad.push(`${at}: split ${JSON.stringify(r.split)} ≠ file-hash ${want} (przeciek części)`);
        }
      }
    }
  }
  const all = [...pub, ...priv];
  const count = (l) => all.filter((r) => r.label === l).length;
  if (all.length < minTotal) bad.push(`za mało par: ${all.length} < ${minTotal}`);
  if (count("same") < minSame) bad.push(`za mało par same: ${count("same")} < ${minSame}`);
  if (count("pattern") < minPattern) bad.push(`za mało par pattern: ${count("pattern")} < ${minPattern}`);
  return bad;
}

function load() {
  const priv = PRIVATE_REF_FILES.flatMap((name) => {
    const file = path.join(here, name);
    return existsSync(file) ? parseJsonl(readFileSync(file, "utf8"), name) : [];
  });
  return {
    pub: parseJsonl(readFileSync(path.join(here, "public.jsonl"), "utf8"), "public.jsonl"),
    priv,
  };
}

function selftest() {
  const { pub, priv } = load();
  // Plant a pair whose files hash to different buckets but claims validation (CON-03 leak).
  const base = priv.find((r) => r?.a?.path && r?.b?.path) ?? priv[0];
  const leakRow = {
    ...base,
    id: "x-leak-split",
    split: "validation",
    a: { ...base.a, path: "aaa/validation-only-plant.ts" },
    b: { ...base.b, path: "zzz/test-only-plant.ts" },
  };
  // Force opposite buckets: retry until fileBucket differs (stable for these two paths).
  const planted = [
    ["kod w pliku prywatnym", pub, [...priv, { ...priv[0], id: "x1", a: { ...priv[0].a, code: "secret()" } }]],
    ["zdublowane id", [...pub, pub[0]], priv],
    ["nieznana etykieta", [...pub, { ...pub[0], id: "x2", label: "maybe" }], priv],
    ["contains bez larger", [...pub, { ...pub[0], id: "x2b", label: "contains" }], priv],
    ["zły zakres linii", pub, [...priv, { ...priv[0], id: "x3", a: { ...priv[0].a, startLine: 9, endLine: 3 } }]],
    ["za mało par", pub.slice(0, 10), priv.slice(0, 5)],
    ["przeciek split po pliku", pub, [...priv, leakRow]],
  ];
  let failed = 0;
  for (const [what, p, q] of planted) {
    const caught = validateGold(p, q).length > 0;
    console.log(`${caught ? "PASS" : "FAIL"}: ${what} → walidacja czerwona`);
    if (!caught) failed++;
  }
  console.log(failed ? `gold selftest: ${failed} FAIL` : "gold selftest: OK");
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--selftest")) selftest();
  execFileSync(process.execPath, [path.join(here, "build-public.mjs"), "--check"], { stdio: "inherit" });
  const { pub, priv } = load();
  const bad = validateGold(pub, priv);
  if (bad.length) {
    for (const b of bad) console.error(`  - ${b}`);
    process.exit(1);
  }
  const by = (l) => [...pub, ...priv].filter((r) => r.label === l).length;
  console.log(
    `gold: OK · ${pub.length} publicznych + ${priv.length} prywatnych · same ${by("same")} · contains ${by("contains")} · concept ${by("concept")} · pattern ${by("pattern")} · different ${by("different")}`,
  );
  // CON-10: path / trivial-local hygiene (tsx so .mts runs without a separate npm script)
  execFileSync(process.execPath, ["--import", "tsx", path.join(here, "check-hygiene.mts")], { stdio: "inherit" });
}
