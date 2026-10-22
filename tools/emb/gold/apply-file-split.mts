#!/usr/bin/env tsx
/**
 * Reassign private ref JSONL `split` using per-file hash (CON-03 step 4).
 * Targets real-refs.jsonl and private-refs.jsonl. Dry-run by default; --apply to write.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectedSplit } from "./file-split.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes("--apply");
const files = ["real-refs.jsonl", "private-refs.jsonl"];

for (const name of files) {
  const refsPath = path.join(here, name);
  if (!existsSync(refsPath)) continue;
  const rows = readFileSync(refsPath, "utf8")
    .trim()
    .split(/\n/)
    .map((l) => JSON.parse(l));

  let changed = 0;
  let validation = 0;
  let test = 0;
  const out = rows.map((r) => {
    const next = expectedSplit(r);
    if (!next) return r;
    if (r.split !== next) changed++;
    if (next === "validation") validation++;
    else test++;
    return { ...r, split: next };
  });

  console.log(JSON.stringify({ file: name, total: rows.length, changed, validation, test }, null, 2));
  if (apply) {
    writeFileSync(refsPath, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
    console.log(`Wrote ${out.length} rows to ${name}`);
  }
}
if (!apply) console.log("Dry-run OK. Re-run with --apply to write.");

