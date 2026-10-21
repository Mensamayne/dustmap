#!/usr/bin/env tsx
/**
 * EMB-09: confidence bands for a model package, from the gold set's validation split only (the test
 * split stays held out for the meter). Every pair is scored through Dustmap's own `onnx` provider —
 * per variant, since the GPU (fp16) and CPU (int8) variants give slightly different similarities.
 * Band = the lowest similarity at which the pairs scoring at least that much reach a precision:
 * high ≥ 0.90, medium ≥ 0.75, low ≥ 0.50 (below low nothing is reported). The bands are written into
 * the package's manifest.json (`variants.<v>.calibration`); manifest.json is not itself checksummed.
 *
 *   npm run emb:calibrate -- --model <package id> [--model-dir <dir>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cosineSimilarity, openOnnxProvider, resolveModelDir } from "@dustmap/core";
import { loadGold, type Scored } from "./gold-data.mts";
import { recallAtPrecision } from "./metrics.mjs";

const argv = process.argv.slice(2);
const arg = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

export const TARGETS = { high: 0.9, medium: 0.75, low: 0.5 } as const;

/** Band thresholds from scored validation pairs. */
export function bandsFrom(scored: readonly Scored[]): { high: number | null; medium: number | null; low: number | null } {
  const at = (p: number) => recallAtPrecision(scored, p).threshold as number | null;
  return { high: at(TARGETS.high), medium: at(TARGETS.medium), low: at(TARGETS.low) };
}

async function main(): Promise<void> {
  const model = arg("model");
  if (!model) throw new Error("--model <package id>");
  const modelDir = arg("model-dir") ? path.resolve(arg("model-dir")!) : resolveModelDir({});
  const { pairs, privateCount, note } = loadGold();
  const validation = pairs.filter((p) => p.split === "validation");
  const manifestPath = path.join(modelDir, model, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { variants: Record<string, Record<string, unknown>> };
  for (const variant of Object.keys(manifest.variants)) {
    const device = variant === "gpu" ? "gpu" : "cpu";
    let provider;
    try {
      provider = await openOnnxProvider({ model, device, modelDir });
    } catch (err) {
      console.log(`${variant}: pominięty — ${(err as Error).message.split("\n")[0]}`);
      continue;
    }
    try {
      const texts = [...new Set(validation.flatMap((p) => [p.a.code, p.b.code]))];
      const vs = await provider.embed(texts);
      const vec = new Map(texts.map((t, k) => [t, vs[k]!]));
      const scored: Scored[] = validation.map((p) => ({ ...p, score: cosineSimilarity(vec.get(p.a.code)!, vec.get(p.b.code)!) }));
      const bands = bandsFrom(scored);
      if (bands.low === null) throw new Error(`${variant}: walidacja nie osiąga nawet precyzji ${TARGETS.low} — model nie nadaje się do raportu`);
      const counts = { same: 0, pattern: 0, different: 0 };
      for (const p of validation) counts[p.label]++;
      manifest.variants[variant]!.calibration = {
        bands,
        method: `lowest similarity whose cumulative precision on the gold validation split reaches high ${TARGETS.high} / medium ${TARGETS.medium} / low ${TARGETS.low}`,
        split: "validation",
        pairs: counts,
        calibratedWith: "dustmap tools/emb/calibrate.mts through the onnx provider",
      };
      console.log(`${variant}: high ${bands.high?.toFixed(3) ?? "—"} · medium ${bands.medium?.toFixed(3) ?? "—"} · low ${bands.low.toFixed(3)} (${validation.length} par walidacji, ${privateCount} prywatnych w całym zbiorze${note ? `; ${note}` : ""})`);
    } finally {
      await provider.release();
    }
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`zapisano: ${manifestPath}`);
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
