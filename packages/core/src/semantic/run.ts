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
import { openOnnxProvider } from "./onnx-provider.js";
import {
  assertHttpProviderAllowed,
  createEmbeddingProvider,
  createMemoryEmbeddingProvider,
  type EmbeddingProvider,
} from "./provider.js";
import { openVectorCache } from "./vector-cache.js";

/** Bump when extraction, scoring or clustering changes (adapter cache key): 2 per-side bodies (BUG-07), 3 parser extraction (EMB-08), 4 calibrated confidence + patterns (EMB-09), 5 onnx default, jscpd path removed (EMB-10), 6 average-linkage groups (EMB-10). */
const ADAPTER_REV = "6";

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
): Promise<SemanticRunResult> {
  // Explicit config wins; a calibrated model reports from its own floor; anything else uses the spike value.
  const threshold = cfg.threshold ?? (calibration ? reportFloor(calibration) : null) ?? UNCALIBRATED_THRESHOLD;
  const vcache = openVectorCache(cacheDir, provider.modelId);
  const embedItems = fns.map((f) => ({ contentHash: hashBody(f.body), text: f.body }));
  const { vectors, newEmbeddings } = await vcache.embedMissing(embedItems, provider);
  vcache.flush();

  const pairs: SemanticPair[] = await pairsAboveThreshold(fns, vectors, threshold);
  const index = new Map(fns.map((f, i) => [f, i]));
  const norms = vectors.map((v) => Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1);
  const similarity = (a: SemanticFunctionRef, b: SemanticFunctionRef): number => {
    const [i, j] = [index.get(a)!, index.get(b)!];
    const [va, vb] = [vectors[i]!, vectors[j]!];
    let dot = 0;
    for (let k = 0; k < va.length; k++) dot += va[k]! * vb[k]!;
    return dot / (norms[i]! * norms[j]!);
  };

  return {
    findings: clusterSemanticPairs(pairs, threshold, calibration, similarity),
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

  if (!opts.provider && cfg.provider === "onnx") {
    const onnx = await openOnnxProvider(cfg);
    try {
      return await runViaEmbed(cfg, fns, cacheDir, onnx, onnx.calibration);
    } finally {
      await onnx.release();
    }
  }
  const provider = opts.provider ?? createEmbeddingProvider(cfg) ?? createMemoryEmbeddingProvider(cfg.model);
  return runViaEmbed(cfg, fns, cacheDir, provider);
}

export async function runSemanticAdapter(ctx: AdapterContext): Promise<FindingType[]> {
  if (ctx.config.semantic.provider === "none") return [];
  if (ctx.config.adapters.semantic?.enabled === false) return [];
  const { findings } = await runSemanticAnalysis(ctx);
  return findings;
}

export function semanticAdapter(): Adapter {
  return {
    name: "semantic",
    version: () => `semantic+dm${ADAPTER_REV}`,
    run: runSemanticAdapter,
  };
}
