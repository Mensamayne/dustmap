/**
 * Semantic duplicate adapter — a Dustmap ONNX model package in-process (`onnx`), local jscpd
 * embeddings, or HTTP OpenAI-compatible providers. Vector/pair caches live under
 * outputDir/cache/semantic. Never sends code off-machine without allowRemote. Never writes into the
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
import { runJscpdSemanticPairs } from "./jscpd-semantic.js";
import { reportFloor, type Calibration } from "./calibration.js";
import { openOnnxProvider } from "./onnx-provider.js";
import { hashesMatch, readPairCache, writePairCache } from "./pair-cache.js";
import {
  assertHttpProviderAllowed,
  createEmbeddingProvider,
  createMemoryEmbeddingProvider,
  type EmbeddingProvider,
} from "./provider.js";
import { openVectorCache } from "./vector-cache.js";

/** Bump when pair extraction or clustering changes; also keys pairs.json (2: per-side bodies, BUG-07; 3: parser extraction, EMB-08; 4: calibrated confidence + structural patterns, EMB-09). */
const ADAPTER_REV = "4";

/** Report threshold for providers without calibration (DUST-15 spike, jina scale). */
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

/** Extract floor: allow smaller fixtures while production keeps config.minTokens for jscpd. */
function extractMinTokens(cfg: SemanticConfig, embedPath: boolean): number {
  if (embedPath) return Math.max(8, Math.min(cfg.minTokens, 20));
  return cfg.minTokens;
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
  /** Override provider (tests inject memory embedder). */
  provider?: EmbeddingProvider | null;
  /** Force embed+cosine path (skip jscpd), used by fixtures/tests. */
  forceEmbedPath?: boolean;
};

function wantsEmbedPath(ctx: AdapterContext, opts: RunSemanticOptions): boolean {
  if (opts.provider || opts.forceEmbedPath) return true;
  if (ctx.config.semantic.provider === "http" || ctx.config.semantic.provider === "onnx") return true;
  const engine = (ctx.config.adapters.semantic?.options as { engine?: string } | undefined)?.engine;
  return engine === "embed";
}

async function runViaJscpd(
  ctx: AdapterContext,
  cfg: SemanticConfig,
  files: readonly string[],
  hashes: string[],
  cacheDir: string,
): Promise<SemanticRunResult> {
  const threshold = cfg.threshold ?? UNCALIBRATED_THRESHOLD;
  const cached = readPairCache(cacheDir);
  if (
    cached &&
    cached.rev === ADAPTER_REV &&
    cached.modelId === cfg.model &&
    cached.threshold === threshold &&
    hashesMatch(cached.functionHashes, hashes)
  ) {
    return {
      findings: clusterSemanticPairs(cached.pairs, threshold),
      stats: { newEmbeddings: 0, functions: hashes.length, pairs: cached.pairs.length },
    };
  }

  const rawPairs = await runJscpdSemanticPairs(ctx.repoRoot, files, {
    model: cfg.model,
    sameThreshold: Math.min(threshold, 0.7),
    minTokens: cfg.minTokens,
    minLines: 5,
  });
  const pairs = rawPairs.filter((p) => p.similarity >= threshold);
  writePairCache(cacheDir, {
    rev: ADAPTER_REV,
    modelId: cfg.model,
    threshold,
    functionHashes: hashes,
    pairs,
  });
  return {
    findings: clusterSemanticPairs(pairs, threshold),
    stats: {
      // jscpd embeds every function on a cache miss; treat as N new embeddings.
      newEmbeddings: hashes.length,
      functions: hashes.length,
      pairs: pairs.length,
    },
  };
}

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
  writePairCache(cacheDir, {
    rev: ADAPTER_REV,
    modelId: provider.modelId,
    threshold,
    functionHashes: embedItems.map((i) => i.contentHash).sort(),
    pairs,
  });

  return {
    findings: clusterSemanticPairs(pairs, threshold, calibration),
    stats: { newEmbeddings, functions: fns.length, pairs: pairs.length },
  };
}

/**
 * Run semantic analysis for a scan context.
 * - `onnx` / `http` / injected provider / `engine: embed` → extract + embed + cosine
 * - `local` → jscpd `--semantic` + pair cache
 * - `none` → empty (unless provider injected for tests)
 */
export async function runSemanticAnalysis(
  ctx: AdapterContext,
  opts: RunSemanticOptions = {},
): Promise<SemanticRunResult> {
  const cfg = ctx.config.semantic;
  if (cfg.provider === "none" && !opts.provider && !opts.forceEmbedPath) {
    return { findings: [], stats: { newEmbeddings: 0, functions: 0, pairs: 0 } };
  }

  if (cfg.provider === "http") {
    assertHttpProviderAllowed(cfg);
  }

  const files = await listSourceFiles(ctx);
  const cacheDir = semanticCacheDir(ctx);
  const hashFloor = extractMinTokens(cfg, wantsEmbedPath(ctx, opts));
  const fnsForHash = await loadFunctions(ctx, files, hashFloor);
  const hashes = fnsForHash.map((f) => hashBody(f.body)).sort();

  if (wantsEmbedPath(ctx, opts)) {
    if (!opts.provider && cfg.provider === "onnx") {
      const onnx = await openOnnxProvider(cfg);
      try {
        return await runViaEmbed(cfg, fnsForHash, cacheDir, onnx, onnx.calibration);
      } finally {
        await onnx.release();
      }
    }
    const provider =
      opts.provider ??
      createEmbeddingProvider(cfg) ??
      createMemoryEmbeddingProvider(cfg.model);
    return runViaEmbed(cfg, fnsForHash, cacheDir, provider);
  }

  if (cfg.provider === "local") {
    return runViaJscpd(ctx, cfg, files, hashes, cacheDir);
  }

  return { findings: [], stats: { newEmbeddings: 0, functions: 0, pairs: 0 } };
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
