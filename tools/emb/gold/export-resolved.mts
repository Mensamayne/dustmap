#!/usr/bin/env tsx
/**
 * Write the gold set exactly as the meter sees it — sides resolved at their pinned commit, class
 * members wrapped, trap flags, units — to .tmp/emb/gold-resolved.jsonl for the training side
 * (dustmap-emb gold_meter.py and check_leakage.py). One loader for all of them, so checkpoint selection and the product meter
 * can never read different pairs (CON-12). The file holds private code: it stays under .tmp (git-ignored)
 * on this machine.
 *
 *   npx tsx tools/emb/gold/export-resolved.mts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadGold, repo } from "../gold-data.mts";

const { pairs, privateCount, note } = loadGold();
const out = path.join(repo, ".tmp/emb/gold-resolved.jsonl");
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(
  out,
  pairs
    .map((p) =>
      JSON.stringify({
        id: p.id,
        label: p.label,
        split: p.split,
        source: p.source,
        trap: p.trap === true,
        unit: p.unit ?? "function",
        a: p.a.code,
        b: p.b.code,
        // Raw spans and paths for the training leak gate (check_leakage.py), which compares unwrapped code.
        spanA: p.a.span ?? p.a.code,
        spanB: p.b.span ?? p.b.code,
        pathA: p.a.path ?? null,
        pathB: p.b.path ?? null,
      }),
    )
    .join("\n") + "\n",
);
console.log(`gold-resolved: ${pairs.length} par (${privateCount} prywatnych) → ${path.relative(repo, out)}${note ? ` · ${note}` : ""}`);
