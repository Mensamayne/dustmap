#!/usr/bin/env tsx
/**
 * Re-split the private gold refs (real-refs.jsonl + private-refs.jsonl together) into validation /
 * test by file groups, balanced per label (file-split.mjs, CON-12). Dry-run by default; --apply writes.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assignSplits, filesInBothParts } from "./file-split.mjs";

type Row = { id: string; label: string; split: string; a: { repo?: string; path?: string }; b: { repo?: string; path?: string } };

const here = path.dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes("--apply");
const files = ["real-refs.jsonl", "private-refs.jsonl"].map((n) => path.join(here, n)).filter((f) => existsSync(f));
const byFile = files.map((f) => ({
  file: f,
  rows: readFileSync(f, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l) as Row),
}));
const all = byFile.flatMap((x) => x.rows);
const parts = assignSplits(all);
const next = all.map((r) => ({ ...r, split: parts.get(r.id)! }));
const leak = filesInBothParts(next);
if (leak.length) throw new Error(`pliki w obu częściach: ${leak.slice(0, 5).join(", ")}`);

const table: Record<string, { validation: number; test: number }> = {};
for (const r of next) {
  table[r.label] ??= { validation: 0, test: 0 };
  table[r.label]![r.split as "validation" | "test"]++;
}
console.log(JSON.stringify({ total: next.length, changed: all.filter((r) => r.split !== parts.get(r.id)).length, byLabel: table }, null, 2));

if (apply) {
  for (const { file, rows } of byFile) {
    writeFileSync(file, rows.map((r) => JSON.stringify({ ...r, split: parts.get(r.id) })).join("\n") + "\n");
  }
  console.log(`Zapisano: ${files.map((f) => path.basename(f)).join(", ")}`);
} else console.log("Dry-run. --apply zapisuje.");
