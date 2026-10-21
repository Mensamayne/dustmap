#!/usr/bin/env tsx
/**
 * EMB meter: how well does a semantic provider tell "same meaning" from "looks alike" on the gold set
 * (tools/emb/gold). Every provider goes through Dustmap's own code path, so the number is what users get.
 *
 *   npm run emb:eval                                   current product path (jscpd --semantic, jina)
 *   npm run emb:eval -- --provider http --url http://127.0.0.1:8080/v1 --model <id>
 *   npm run emb:eval -- --provider onnx --model <package id> [--model-dir <dir>] [--device auto|gpu|cpu] [--calibrated]
 *     --calibrated: also the report's confidence levels (the model's calibrated bands + the structural
 *     pattern rule, as a scan assigns them) and the EMB-09 goals on the held-out test split
 *   npm run emb:eval -- --selftest                     oracle / inverted / random must land where expected
 *
 * Options: --threshold 0.82 · --concurrency 4 · --note "…" · --no-write (skip results table).
 * Private pairs are read from the pinned snapshot (.tmp/targets/…); missing snapshot = public only.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  confidenceFor,
  cosineSimilarity,
  createOpenAiCompatibleProvider,
  lowerConfidence,
  openOnnxProvider,
  runJscpdSemanticPairs,
  sharedPattern,
  type Calibration,
  type Confidence,
} from "@dustmap/core";
import { goldDir, jsonl, loadPrivate, repo, type GoldPair, type Scored } from "./gold-data.mts";
import { summarize } from "./metrics.mjs";

const argv = process.argv.slice(2);
const arg = (name: string, fallback?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[i + 1]! : fallback;
};
const has = (name: string) => argv.includes(`--${name}`);

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

/** Today's product path: jscpd --semantic on a two-file tree per pair (so one pair cannot hide another). */
async function scoreCurrent(pairs: GoldPair[], model: string, concurrency: number): Promise<Scored[]> {
  return pool(pairs, concurrency, async (p) => {
    const dir = mkdtempSync(path.join(tmpdir(), "dustmap-emb-"));
    try {
      writeFileSync(path.join(dir, "a.ts"), `${p.a.code}\n`);
      writeFileSync(path.join(dir, "b.ts"), `${p.b.code}\n`);
      const found = await runJscpdSemanticPairs(dir, ["a.ts", "b.ts"], { model, sameThreshold: 0.01, minTokens: 10, minLines: 3 });
      const cross = found.filter((x) => x.a.path !== x.b.path).map((x) => x.similarity);
      return { ...p, score: cross.length ? Math.max(...cross) : null };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

/** Any OpenAI-compatible embeddings endpoint through Dustmap's provider (loopback only by default). */
async function scoreHttp(pairs: GoldPair[], url: string, model: string): Promise<Scored[]> {
  const provider = createOpenAiCompatibleProvider({ url, model, allowRemote: false });
  const texts = [...new Set(pairs.flatMap((p) => [p.a.code, p.b.code]))];
  const vectors = new Map<string, number[]>();
  for (let i = 0; i < texts.length; i += 32) {
    const batch = texts.slice(i, i + 32);
    const vs = await provider.embed(batch);
    batch.forEach((t, k) => vectors.set(t, vs[k]!));
  }
  return pairs.map((p) => ({ ...p, score: cosineSimilarity(vectors.get(p.a.code)!, vectors.get(p.b.code)!) }));
}

/** A Dustmap model package in-process — the `onnx` provider exactly as a scan uses it. */
async function scoreOnnx(pairs: GoldPair[], model: string, modelDir: string | undefined, device: "auto" | "gpu" | "cpu"): Promise<{ scored: Scored[]; variant: string; size: string; calibration: Calibration | null }> {
  const provider = await openOnnxProvider({ model, device, ...(modelDir ? { modelDir: path.resolve(modelDir) } : {}) });
  try {
    const texts = [...new Set(pairs.flatMap((p) => [p.a.code, p.b.code]))];
    const vs = await provider.embed(texts);
    const vectors = new Map(texts.map((t, k) => [t, vs[k]!]));
    const file = provider.manifest.variants[provider.variant]!.file;
    const fallback = provider.gpuFallbackReason ? ` (GPU niedostępne: ${provider.gpuFallbackReason})` : "";
    return {
      scored: pairs.map((p) => ({ ...p, score: cosineSimilarity(vectors.get(p.a.code)!, vectors.get(p.b.code)!) })),
      variant: `${provider.variant}${fallback}`,
      size: `${Math.round(provider.manifest.files[file]!.bytes / 1024 / 1024)} MB`,
      calibration: provider.calibration,
    };
  } finally {
    await provider.release();
  }
}

/** Confidence a scan would report for one pair: calibrated band, one level less for a deliberate pattern. */
function reportedConfidence(p: Scored, cal: Calibration): Confidence | null {
  const band = confidenceFor(p.score ?? 0, cal);
  if (!band) return null;
  return sharedPattern(p.a.code, p.b.code) ? lowerConfidence(band) : band;
}

/** EMB-09 goals on one split: precision of `high` and of `medium`-or-better, patterns kept below `medium`. */
function calibratedSummary(set: Scored[], cal: Calibration) {
  const levels = set.map((p) => ({ p, c: reportedConfidence(p, cal) }));
  const precision = (keep: (c: Confidence | null) => boolean) => {
    const hits = levels.filter((x) => keep(x.c));
    return { n: hits.length, value: hits.length ? hits.filter((x) => x.p.label === "same").length / hits.length : null };
  };
  const high = precision((c) => c === "high");
  const mediumUp = precision((c) => c === "high" || c === "medium");
  const same = levels.filter((x) => x.p.label === "same");
  const patterns = levels.filter((x) => x.p.label === "pattern");
  return {
    high,
    mediumUp,
    recallMediumUp: same.length ? same.filter((x) => x.c === "high" || x.c === "medium").length / same.length : null,
    patternsBelowMedium: patterns.length ? patterns.filter((x) => x.c === "low" || x.c === null).length / patterns.length : null,
    patternRule: patterns.filter((x) => sharedPattern(x.p.a.code, x.p.b.code)).length,
    patterns: patterns.length,
  };
}

/** Seeded pseudo-random score — the "model knows nothing" baseline. */
function randomScore(id: string): number {
  return createHash("sha256").update(id).digest().readUInt32BE(0) / 0xffffffff;
}

function dirBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const p = path.join(dir, e.name);
    return sum + (e.isDirectory() ? dirBytes(p) : statSync(p).size);
  }, 0);
}

function fmt(x: number | null | undefined, digits = 3): string {
  return typeof x === "number" ? x.toFixed(digits) : "—";
}

function selftest(pairs: GoldPair[]): never {
  const base = pairs.filter((p) => p.label === "same").length / pairs.length;
  const runs = {
    oracle: summarize(pairs.map((p) => ({ ...p, score: p.label === "same" ? 0.95 : 0.2 })), 0.82),
    inverted: summarize(pairs.map((p) => ({ ...p, score: p.label === "same" ? 0.2 : 0.95 })), 0.82),
    random: summarize(pairs.map((p) => ({ ...p, score: randomScore(p.id) })), 0.82),
  };
  const checks: Array<[string, boolean]> = [
    ["wyrocznia → AP 1.0", runs.oracle.ap > 0.999],
    ["wyrocznia → precyzja i wykrywalność 1.0", runs.oracle.at.precision === 1 && runs.oracle.at.recall === 1],
    ["odwrócona wyrocznia → AP ≤ odsetek same + 0.05", runs.inverted.ap <= base + 0.05],
    [`losowe wyniki → AP blisko odsetka same (${base.toFixed(2)} ± 0.15)`, Math.abs(runs.random.ap - base) <= 0.15],
    ["brak wyniku liczony jako 0, nie pomijany", summarize(pairs.map((p) => ({ ...p, score: null })), 0.82).at.recall === 0],
  ];
  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
    if (!ok) failed++;
  }
  console.log(failed ? `emb meter selftest: ${failed} FAIL` : "emb meter selftest: OK — miernik nie kłamie");
  process.exit(failed ? 1 : 0);
}

function appendResults(row: string): void {
  const file = path.join(repo, "docs/experiments/emb-results.md");
  const header = [
    "# Wyniki: „ten sam sens” na zbiorze wzorcowym (EMB)",
    "",
    "Każdy wiersz to jeden przebieg `npm run emb:eval` na zbiorze z `tools/emb/gold` (EMB-01). **same** = ta sama logika (klasa pozytywna); **pattern** i **different** = negatywy. Główna liczba to **AP** (średnia precyzja rankingu: 1,0 = wszystkie pary `same` nad wszystkimi pozostałymi; los ≈ odsetek par `same`). „Brak wyniku” = dostawca w ogóle nie połączył pary (liczone jako 0). Zbiór `test` jest odłożony — nie trenujemy ani nie stroimy na nim progów.",
    "",
    "| Data | Dostawca / model | Zbiór | Par | AP | Precyzja @próg | Wykrywalność @próg | `pattern` pod progiem | Najlepszy próg (F1) | Brak wyniku | Śr. same / pattern / different | Czas | Rozmiar modelu | Uwagi |",
    "|---|---|---|--:|--:|--:|--:|--:|---|--:|---|--:|--:|---|",
  ].join("\n");
  const current = existsSync(file) ? readFileSync(file, "utf8").trimEnd() : header;
  writeFileSync(file, `${current}\n${row}\n`);
}

async function main(): Promise<void> {
  const publicPairs = jsonl<GoldPair>(path.join(goldDir, "public.jsonl"));
  const priv = loadPrivate();
  const pairs = [...publicPairs, ...priv.pairs];
  if (has("selftest")) selftest(pairs);

  const provider = arg("provider", "current")!;
  const threshold = Number(arg("threshold", "0.82"));
  const model = arg("model", provider === "current" ? "jina-embeddings-v2-base-code" : undefined);
  const t0 = Date.now();
  let scored: Scored[];
  let size = "—";
  let variantNote = "";
  let calibration: Calibration | null = null;
  if (provider === "current") {
    scored = await scoreCurrent(pairs, model!, Number(arg("concurrency", "4")));
    const bytes = dirBytes(path.join(process.env.LOCALAPPDATA ?? "", "jscpd/cache/models", `jinaai--${model}`));
    if (bytes) size = `${Math.round(bytes / 1024 / 1024)} MB`;
  } else if (provider === "http") {
    if (!arg("url") || !model) throw new Error("--provider http needs --url and --model");
    scored = await scoreHttp(pairs, arg("url")!, model);
  } else if (provider === "onnx") {
    if (!model) throw new Error("--provider onnx needs --model <package id>");
    const device = arg("device", "auto") as "auto" | "gpu" | "cpu";
    if (!["auto", "gpu", "cpu"].includes(device)) throw new Error("--device: auto | gpu | cpu");
    const r = await scoreOnnx(pairs, model, arg("model-dir"), device);
    scored = r.scored;
    size = r.size;
    variantNote = `wariant ${r.variant}`;
    calibration = r.calibration;
  } else if (provider === "random") {
    scored = pairs.map((p) => ({ ...p, score: randomScore(p.id) }));
  } else {
    throw new Error(`Unknown --provider ${provider} (current | http | onnx | random)`);
  }
  const seconds = (Date.now() - t0) / 1000;

  const sets: Array<[string, Scored[]]> = [
    ["test", scored.filter((p) => p.split === "test")],
    ["całość", scored],
  ];
  const label = provider === "current" ? `obecny: jscpd --semantic · ${model}` : `${provider}${model ? ` · ${model}` : ""}`;
  const notes = [arg("note"), variantNote, priv.note].filter(Boolean).join("; ");
  console.log(`\n${label} · ${pairs.length} par (${priv.pairs.length} prywatnych) · ${seconds.toFixed(1)} s\n`);
  for (const [name, set] of sets) {
    const s = summarize(set, threshold);
    console.log(
      `${name.padEnd(7)} AP ${fmt(s.ap)} · @${threshold}: precyzja ${fmt(s.at.precision)} wykrywalność ${fmt(s.at.recall)} · pattern pod progiem ${fmt(s.at.patternBelow)} · najlepszy próg ${fmt(s.best.threshold)} (F1 ${fmt(s.best.f1)}) · brak wyniku ${s.noScore}/${s.pairs}`,
    );
    console.log(`        średnio: same ${fmt(s.mean.same)} · pattern ${fmt(s.mean.pattern)} · different ${fmt(s.mean.different)}`);
    if (!has("no-write")) {
      appendResults(
        `| ${new Date().toLocaleDateString("sv-SE")} | ${label} | ${name} | ${s.pairs} | ${fmt(s.ap)} | ${fmt(s.at.precision)} | ${fmt(s.at.recall)} | ${fmt(s.at.patternBelow)} | ${fmt(s.best.threshold)} (F1 ${fmt(s.best.f1, 2)}) | ${s.noScore} | ${fmt(s.mean.same, 2)} / ${fmt(s.mean.pattern, 2)} / ${fmt(s.mean.different, 2)} | ${seconds.toFixed(0)} s | ${size} | ${notes} |`,
      );
    }
  }
  if (has("calibrated")) {
    if (!calibration) throw new Error("--calibrated: the model package has no calibration (npm run emb:calibrate -- --model <id>)");
    const b = calibration.bands;
    console.log(`
kalibracja: high ≥ ${fmt(b.high)} · medium ≥ ${fmt(b.medium)} (raport od medium; wzorzec o stopień niżej)`);
    let goalsMet = true;
    for (const [name, set] of sets) {
      const c = calibratedSummary(set, calibration);
      console.log(
        `${name.padEnd(7)} precyzja high ${fmt(c.high.value)} (${c.high.n} par) · precyzja ≥ medium ${fmt(c.mediumUp.value)} (${c.mediumUp.n}) · wykrywalność ≥ medium ${fmt(c.recallMediumUp)} · wzorce poniżej medium ${fmt(c.patternsBelowMedium)} (reguła rozpoznała ${c.patternRule}/${c.patterns})`,
      );
      if (name === "test") goalsMet = (c.high.value ?? 1) >= 0.9 && (c.mediumUp.value ?? 0) >= 0.75 && (c.patternsBelowMedium ?? 0) >= 0.8;
    }
    console.log(goalsMet ? "cele EMB-09 na części test: spełnione" : "cele EMB-09 na części test: NIE spełnione");
  }
  const rawDir = path.join(repo, ".tmp/emb");
  mkdirSync(rawDir, { recursive: true });
  // Ids and scores only — no code, so private pairs never land in a file by accident.
  const raw = scored.map(({ id, label: l, split, score }) => ({ id, label: l, split, score }));
  writeFileSync(path.join(rawDir, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), JSON.stringify({ provider, model, threshold, raw }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
});
