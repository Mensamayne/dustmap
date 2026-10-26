/**
 * Semantic duplicate adapter — a Dustmap ONNX model package in-process (`onnx`, default) or an HTTP
 * OpenAI-compatible provider: extract functions, embed (vector cache under outputDir/cache/semantic),
 * score every pair, group. Never sends code off-machine without allowRemote. Never writes into the
 * scanned repo source tree.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import type { FindingType } from "@dustmap/contract";
import type { Adapter, AdapterContext } from "../adapter.js";
import { resolveOutputDir } from "../config/load.js";
import type { SemanticConfig } from "../config/schema.js";
import {
  clusterSemanticPairs,
  pairsAboveThreshold,
  type SemanticFunctionRef,
  type SemanticPair,
} from "./cluster.js";
import { extractFunctions } from "./extract.js";
import { reportFloor, type Calibration } from "./calibration.js";
import { OnnxModelError, openOnnxProvider, type OnnxProvider } from "./onnx-provider.js";
import { LayerUnavailableError } from "../layer-unavailable.js";
import { openJudge, type OpenedJudge, type PairJudge } from "../judge/judge.js";
import type { DustmapConfig } from "../config/schema.js";
import type { JudgeNote } from "./cluster.js";
import {
  assertHttpProviderAllowed,
  createEmbeddingProvider,
  createMemoryEmbeddingProvider,
  type EmbeddingProvider,
} from "./provider.js";
import { openVectorCache } from "./vector-cache.js";

/** Bump when extraction, scoring or clustering changes (adapter cache key): 2 per-side bodies (BUG-07), 3 parser extraction (EMB-08), 4 calibrated confidence + patterns (EMB-09), 5 onnx default, jscpd path removed (EMB-10), 6 average-linkage groups (EMB-10), 7 PAIR pair-head filter, 8 pair judge (DUP-04), 9 LF line endings in unit bodies (BUG-14), 10 judged groups reported from the high band (DUP-08). */
const ADAPTER_REV = "10";

/** Report threshold for providers without calibration (HTTP; DUST-15 spike value). */
const UNCALIBRATED_THRESHOLD = 0.82;

export type SemanticRunStats = {
  newEmbeddings: number;
  functions: number;
  pairs: number;
};

export type SemanticRunResult = {
  findings: FindingType[];
  stats: SemanticRunStats;
};

function semanticCacheDir(ctx: AdapterContext): string {
  const out = resolveOutputDir(ctx.repoRoot, ctx.config.outputDir);
  return path.join(out, "cache", "semantic");
}

function hashBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex").slice(0, 32);
}

/** Token floor for extracted functions: config.minTokens, capped so small units still count. */
function extractMinTokens(cfg: SemanticConfig): number {
  return Math.max(8, Math.min(cfg.minTokens, 20));
}

async function listSourceFiles(ctx: AdapterContext): Promise<string[]> {
  return ctx.filesWithRole("source").slice().sort();
}

async function loadFunctions(
  ctx: AdapterContext,
  files: readonly string[],
  minTokens: number,
): Promise<SemanticFunctionRef[]> {
  const fns: SemanticFunctionRef[] = [];
  for (const f of files) {
    const text = await ctx.readFile(f);
    for (const ef of extractFunctions(f, text, minTokens)) {
      fns.push({
        path: ef.path,
        name: ef.name,
        startLine: ef.startLine,
        endLine: ef.endLine,
        body: ef.body,
      });
    }
  }
  return fns;
}

export type RunSemanticOptions = {
  /** Override provider (tests inject a memory embedder). */
  provider?: EmbeddingProvider | null;
};

/** `fns` were extracted once by runSemanticAnalysis with the embed-path token floor. */
async function runViaEmbed(
  cfg: SemanticConfig,
  fns: readonly SemanticFunctionRef[],
  cacheDir: string,
  provider: EmbeddingProvider,
  calibration: Calibration | null = null,
  onnx: OnnxProvider | null = null,
  judge: { judge: PairJudge | null; note: JudgeNote | null } = { judge: null, note: null },
): Promise<SemanticRunResult> {
  // Explicit config wins; a calibrated model reports from its own floor; anything else uses the spike value.
  const threshold = cfg.threshold ?? (calibration ? reportFloor(calibration) : null) ?? UNCALIBRATED_THRESHOLD;
  const vcache = openVectorCache(cacheDir, provider.modelId);
  const embedItems = fns.map((f) => ({ contentHash: hashBody(f.body), text: f.body }));
  const { vectors, newEmbeddings } = await vcache.embedMissing(embedItems, provider);
  vcache.flush();

  // Pair head re-scores cosine candidates; keep the same floor (widening to 0.25 explodes pair count).
  let pairs: SemanticPair[] = await pairsAboveThreshold(fns, vectors, threshold);
  const index = new Map(fns.map((f, i) => [f, i]));
  const norms = vectors.map((v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1);
  const similarity = (a: SemanticFunctionRef, b: SemanticFunctionRef): number => {
    const [i, j] = [index.get(a)!, index.get(b)!];
    const [va, vb] = [vectors[i]!, vectors[j]!];
    let dot = 0;
    for (let k = 0; k < va.length; k++) dot += va[k]! * vb[k]!;
    return dot / (norms[i]! * norms[j]!);
  };

  if (onnx?.scorePair && onnx.pairHeadSameMinProb != null) {
    const minP = onnx.pairHeadSameMinProb;
    const scorePair = onnx.scorePair;
    const scored: SemanticPair[] = [];
    for (const p of pairs) {
      const i = index.get(p.a)!;
      const j = index.get(p.b)!;
      const head = await scorePair(vectors[i]!, vectors[j]!);
      if (head.predicted === "other") continue;
      if (head.predicted === "same" && head.pSame < minP) continue;
      // Keep pattern edges for demotion; score at least the report floor so clustering retains them.
      const sim = head.predicted === "same" ? head.pSame : Math.max(head.pSame, threshold);
      scored.push({ a: p.a, b: p.b, similarity: Math.max(sim, threshold), pairClass: head.predicted });
    }
    pairs = scored;
  }

  // L4: the judge reads both functions of each candidate pair; the groups it reads as a shared pattern or
  // different work are demoted to low confidence (cluster.ts), never dropped.
  if (judge.judge && pairs.length > 0) {
    const verdicts = await judge.judge.judge(pairs.map((p) => [p.a.body, p.b.body] as const));
    pairs = pairs.map((p, k) => (verdicts[k] ? { ...p, judged: verdicts[k]! } : p));
  }

  return {
    findings: clusterSemanticPairs(pairs, threshold, calibration, similarity, judge.note),
    stats: { newEmbeddings, functions: fns.length, pairs: pairs.length },
  };
}

/**
 * Run semantic analysis for a scan context: `onnx` (model package) or `http` (or an injected
 * provider) → extract + embed + every pair + groups; `none` → nothing.
 */
export async function runSemanticAnalysis(
  ctx: AdapterContext,
  opts: RunSemanticOptions = {},
): Promise<SemanticRunResult> {
  const cfg = ctx.config.semantic;
  if (cfg.provider === "none" && !opts.provider) {
    return { findings: [], stats: { newEmbeddings: 0, functions: 0, pairs: 0 } };
  }
  if (!opts.provider && cfg.provider === "http") assertHttpProviderAllowed(cfg);

  const files = await listSourceFiles(ctx);
  const cacheDir = semanticCacheDir(ctx);
  const fns = await loadFunctions(ctx, files, extractMinTokens(cfg));

  // The scan's judge when there is one; a direct caller (the meter, tests) gets its own, released here.
  const owned: OpenedJudge | null = ctx.judge ? null : await openJudge(ctx.config.judge, { ...(cfg.modelDir ? { modelDir: cfg.modelDir } : {}), outputDir: resolveOutputDir(ctx.repoRoot, ctx.config.outputDir) });
  const opened = owned ?? (await ctx.judge!());
  const note: JudgeNote | null = opened.judge
    ? { id: opened.judge.id, threshold: opened.judge.threshold, minBand: ctx.config.judge.minBand }
    : opened.note
      ? { missing: opened.note }
      : null;
  const judge = { judge: opened.judge, note };
  try {
    if (!opts.provider && cfg.provider === "onnx") {
      const onnx = await openOnnxProvider(cfg);
      try {
        return await runViaEmbed(cfg, fns, cacheDir, onnx, onnx.calibration, onnx, judge);
      } finally {
        await onnx.release();
      }
    }
    const provider = opts.provider ?? createEmbeddingProvider(cfg) ?? createMemoryEmbeddingProvider(cfg.model);
    return await runViaEmbed(cfg, fns, cacheDir, provider, null, null, judge);
  } finally {
    await owned?.judge?.release();
  }
}

export async function runSemanticAdapter(ctx: AdapterContext): Promise<FindingType[]> {
  if (ctx.config.semantic.provider === "none") return [];
  if (ctx.config.adapters.semantic?.enabled === false) return [];
  try {
    const { findings } = await runSemanticAnalysis(ctx);
    return findings;
  } catch (err) {
    // Not installed is the user's setup, not a fault: the layer is off and the note says how to turn it on.
    if (err instanceof OnnxModelError && err.code === "onnx_model_missing") {
      const id = ctx.config.semantic.model;
      throw new LayerUnavailableError(
        `same-meaning layer off: embedding model "${id}" is not installed. Turn it on by installing the package (\`dustmap model pull ${id}\`), by pointing semantic at another model (an OpenAI-compatible API or a local server), or silence this with semantic.provider "none" — see docs/MODELS.md.`,
      );
    }
    throw err;
  }
}

export function semanticAdapter(): Adapter {
  return {
    name: "semantic",
    // Results depend on the embedding model and the judge, not only on the files (V1-01).
    version: (config: DustmapConfig) =>
      `semantic+dm${ADAPTER_REV}+${config.semantic.provider}:${config.semantic.model}+judge:${config.judge.provider}:${config.judge.model ?? "-"}:${config.judge.minBand}`,
    run: runSemanticAdapter,
  };
}
