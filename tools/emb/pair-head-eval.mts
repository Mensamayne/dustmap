#!/usr/bin/env tsx
/**
 * PAIR-01 meter: three-class pair head (or cosine baseline) on gold v2.
 *
 *   npm run emb:pair-eval -- --selftest
 *   npm run emb:pair-eval -- --baseline
 *   npm run emb:pair-eval -- --model dustmap-same-meaning-private-pair [--device cpu]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cosinePairBaseline,
  cosineSimilarity,
  mapGoldLabelToPairClass,
  openOnnxProvider,
  PAIR_HEAD_CLASSES,
  type PairHeadClass,
} from "@dustmap/core";
import { goldDir, isRealSource, loadPrivate, type GoldPair } from "./gold-data.mts";

const argv = process.argv.slice(2);
const has = (n: string) => argv.includes(`--${n}`);
const arg = (n: string, fb?: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[i + 1]! : fb;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadPublic(): GoldPair[] {
  const f = path.join(goldDir, "pairs.jsonl");
  if (!existsSync(f)) return [];
  return readFileSync(f, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as GoldPair);
}

type Row = { id: string; split: string; gold: PairHeadClass; pred: PairHeadClass; pSame: number; cosine: number };

function confusion(rows: Row[]) {
  const m: Record<string, Record<string, number>> = {};
  for (const g of PAIR_HEAD_CLASSES) {
    m[g] = { same: 0, pattern: 0, other: 0 };
  }
  for (const r of rows) m[r.gold]![r.pred]! += 1;
  return m;
}

function metrics(rows: Row[]) {
  const acc = rows.length ? rows.filter((r) => r.gold === r.pred).length / rows.length : 0;
  const same = rows.filter((r) => r.gold === "same");
  const predSame = rows.filter((r) => r.pred === "same");
  const tp = rows.filter((r) => r.gold === "same" && r.pred === "same").length;
  const prec = predSame.length ? tp / predSame.length : 0;
  const rec = same.length ? tp / same.length : 0;
  const ranked = [...rows].sort((a, b) => b.pSame - a.pSame || a.id.localeCompare(b.id));
  let hit = 0;
  let ap = 0;
  let pos = 0;
  for (let i = 0; i < ranked.length; i++) {
    if (ranked[i]!.gold === "same") {
      pos += 1;
      hit += 1;
      ap += hit / (i + 1);
    }
  }
  return { n: rows.length, accuracy: acc, samePrecision: prec, sameRecall: rec, sameAp: pos ? ap / pos : 0, confusion: confusion(rows) };
}

function pickFloors(val: { cosine: number; gold: PairHeadClass }[]) {
  // Sweep sameFloor on validation; patternFloor = sameFloor - 0.15 (clamped).
  let best = { sameFloor: 0.85, patternFloor: 0.7, f1: -1 };
  for (let s = 50; s <= 99; s++) {
    const sameFloor = s / 100;
    const patternFloor = Math.max(0.2, sameFloor - 0.15);
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const r of val) {
      const pred = cosinePairBaseline(r.cosine, sameFloor, patternFloor);
      if (r.gold === "same" && pred === "same") tp += 1;
      if (r.gold !== "same" && pred === "same") fp += 1;
      if (r.gold === "same" && pred !== "same") fn += 1;
    }
    const prec = tp + fp ? tp / (tp + fp) : 0;
    const rec = tp + fn ? tp / (tp + fn) : 0;
    const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
    if (f1 > best.f1) best = { sameFloor, patternFloor, f1 };
  }
  return best;
}

async function selftest(): Promise<void> {
  const a = mapGoldLabelToPairClass("contains");
  if (a !== "other") throw new Error("contains → other");
  const base = cosinePairBaseline(0.99, 0.9, 0.7);
  if (base !== "same") throw new Error("baseline same");
  console.log("PASS: emb:pair-eval selftest");
}

async function main(): Promise<void> {
  if (has("selftest")) {
    await selftest();
    return;
  }

  const { pairs: priv, note } = loadPrivate();
  const all = [...loadPublic(), ...priv];
  if (note) console.error(note);
  if (all.length === 0) throw new Error("no gold pairs");

  const model = arg("model");
  const device = (arg("device", "cpu") ?? "cpu") as "auto" | "gpu" | "cpu";
  const modelDir = arg("model-dir");

  const texts = [...new Set(all.flatMap((p) => [p.a.code, p.b.code]))];
  const rows: Row[] = [];
  let floors = { sameFloor: 0.85, patternFloor: 0.7, f1: 0 };
  let mode = "";

  /** Fast path: reuse dumped EMB-15 features + only run the pair-head ONNX. */
  const dumpPath = path.join(process.env.DUSTMAP_EMB_DATA ?? "E:\\dustmap-emb-data", "data", "pair-head", "gold-features.jsonl");
  if (model && !has("baseline") && existsSync(dumpPath)) {
    const { openPairHeadSession } = await import("@dustmap/core");
    const { resolveModelDir } = await import("@dustmap/core");
    const dir = modelDir ? path.resolve(modelDir) : resolveModelDir({});
    const manifest = JSON.parse(readFileSync(path.join(dir, model, "manifest.json"), "utf8")) as {
      pairHead?: { file: string; embeddingDim: number };
      output: { dimensions: number };
    };
    if (!manifest.pairHead) throw new Error(`model ${model} has no pairHead in manifest`);
    const head = await openPairHeadSession(path.join(dir, model, manifest.pairHead.file), manifest.pairHead.embeddingDim);
    try {
      const byId = new Map(all.map((p) => [p.id, p]));
      for (const line of readFileSync(dumpPath, "utf8").split(/\r?\n/)) {
        if (!line.trim()) continue;
        const row = JSON.parse(line) as { id: string; split: string; label: number; cosine: number; features: number[] };
        const g = byId.get(row.id);
        if (!g) continue;
        // Reconstruct a/b halves from features is unnecessary — score via raw features through a tiny adapter:
        // openPairHeadSession expects vectors; feed by splitting features is wrong. Use onnx Tensor path via score on reconstructed.
        const d = manifest.pairHead.embeddingDim;
        const a = row.features.slice(0, d);
        const b = row.features.slice(d, 2 * d);
        const h = await head.score(a, b);
        rows.push({
          id: row.id,
          split: row.split,
          gold: mapGoldLabelToPairClass(g.label),
          pred: h.predicted,
          pSame: h.pSame,
          cosine: row.cosine,
        });
      }
    } finally {
      await head.release();
    }
    mode = `pair-head:${model} (from dump)`;
  } else if (model && !has("baseline")) {
    const provider = await openOnnxProvider({
      model,
      device,
      ...(modelDir ? { modelDir: path.resolve(modelDir) } : {}),
    });
    try {
      const vs = await provider.embed(texts);
      const vectors = new Map(texts.map((t, i) => [t, vs[i]!]));
      if (!provider.scorePair) throw new Error(`model ${model} has no pairHead`);
      for (const p of all) {
        const va = vectors.get(p.a.code)!;
        const vb = vectors.get(p.b.code)!;
        const h = await provider.scorePair(va, vb);
        rows.push({
          id: p.id,
          split: p.split,
          gold: mapGoldLabelToPairClass(p.label),
          pred: h.predicted,
          pSame: h.pSame,
          cosine: cosineSimilarity(va, vb),
        });
      }
    } finally {
      await provider.release();
    }
    mode = `pair-head:${model}`;
  } else {
    const baselineModel = arg("embed-model", "dustmap-same-meaning-private")!;
    const provider = await openOnnxProvider({
      model: baselineModel,
      device: "cpu",
      ...(modelDir ? { modelDir: path.resolve(modelDir) } : {}),
    });
    const scored: { p: GoldPair; cosine: number; gold: PairHeadClass }[] = [];
    try {
      const vs = await provider.embed(texts);
      const vectors = new Map(texts.map((t, i) => [t, vs[i]!]));
      for (const p of all) {
        const cosine = cosineSimilarity(vectors.get(p.a.code)!, vectors.get(p.b.code)!);
        scored.push({ p, cosine, gold: mapGoldLabelToPairClass(p.label) });
      }
    } finally {
      await provider.release();
    }
    floors = pickFloors(scored.filter((s) => s.p.split === "validation").map((s) => ({ cosine: s.cosine, gold: s.gold })));
    for (const s of scored) {
      const pred = cosinePairBaseline(s.cosine, floors.sameFloor, floors.patternFloor);
      rows.push({ id: s.p.id, split: s.p.split, gold: s.gold, pred, pSame: s.cosine, cosine: s.cosine });
    }
    mode = `cosine-baseline floors=${floors.sameFloor}/${floors.patternFloor}`;
  }

  const by = (split: string) => metrics(rows.filter((r) => r.split === split));
  const real = metrics(rows.filter((r) => {
    const g = all.find((p) => p.id === r.id);
    return g ? isRealSource(g.source) : false;
  }));

  const report = {
    at: new Date().toISOString(),
    mode,
    validation: by("validation"),
    test: by("test"),
    real,
    floors,
  };
  console.log(JSON.stringify(report, null, 2));
  const outDir = path.join(root, ".tmp", "emb");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "pair-head-eval.json"), `${JSON.stringify(report, null, 2)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
