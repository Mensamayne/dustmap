#!/usr/bin/env tsx
/**
 * Dump gold pair features (EMB-15 embeddings + PAIR class labels) for pair_head.py training.
 * Writes under DUSTMAP_EMB_DATA/data/pair-head/ (default E:\dustmap-emb-data).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cosineSimilarity, mapGoldLabelToPairClass, openOnnxProvider, pairClassIndex, pairFeatures } from "@dustmap/core";
import { goldDir, loadPrivate, type GoldPair } from "./gold-data.mts";

const dataRoot = process.env.DUSTMAP_EMB_DATA ?? "E:\\dustmap-emb-data";
const outDir = path.join(dataRoot, "data", "pair-head");
const model = process.argv.includes("--model")
  ? process.argv[process.argv.indexOf("--model") + 1]!
  : "dustmap-same-meaning-private";

function loadPublic(): GoldPair[] {
  const f = path.join(goldDir, "pairs.jsonl");
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as GoldPair);
}

async function main() {
  const { pairs: priv, note } = loadPrivate();
  if (note) console.error(note);
  const all = [...loadPublic(), ...priv];
  const provider = await openOnnxProvider({ model, device: "cpu" });
  try {
    const texts = [...new Set(all.flatMap((p) => [p.a.code, p.b.code]))];
    console.error(`embed ${texts.length} texts with ${model}…`);
    const vs = await provider.embed(texts);
    const vectors = new Map(texts.map((t, i) => [t, vs[i]!]));
    const dim = vs[0]?.length ?? 0;
    mkdirSync(outDir, { recursive: true });
    const lines: string[] = [];
    for (const p of all) {
      const a = vectors.get(p.a.code)!;
      const b = vectors.get(p.b.code)!;
      const cls = mapGoldLabelToPairClass(p.label);
      const feats = pairFeatures(a, b);
      lines.push(
        JSON.stringify({
          id: p.id,
          split: p.split,
          label: pairClassIndex(cls),
          class: cls,
          cosine: cosineSimilarity(a, b),
          features: [...feats],
        }),
      );
    }
    const out = path.join(outDir, "gold-features.jsonl");
    writeFileSync(out, `${lines.join("\n")}\n`);
    writeFileSync(
      path.join(outDir, "meta.json"),
      `${JSON.stringify({ model, dim, featureLen: 4 * dim, n: lines.length, at: new Date().toISOString() }, null, 2)}\n`,
    );
    console.log(out);
  } finally {
    await provider.release();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
