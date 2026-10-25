/**
 * One pair judge for the whole scan (V1-01, layer L4), whatever runs it: a Dustmap model package
 * (ONNX, CPU or GPU), an OpenAI-compatible API, the Anthropic API — or none. Every judge reads both
 * pieces of a pair and returns the probability that they do the same job, compared with its threshold.
 * `openJudge` builds it from `judge` config; a package that is not installed is a note, not an error
 * (the scan falls back to similarity alone and says so); a broken setup (no API key for a remote API,
 * remote without allowRemote, a damaged package) is an error. The scan opens the judge once and
 * releases it at the end. Every judge's verdicts are kept under outputDir (one file per judge, keyed by
 * the hash of both pieces), so a re-scan reads only changed pairs; an API judge reads at most
 * `judge.maxPairs` new pairs per scan (the cost cap), the rest stay unjudged.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { JudgementType } from "@dustmap/contract";
import type { JudgeConfig } from "../config/schema.js";
import { OnnxModelError, resolveModelDir } from "../semantic/onnx-provider.js";
import { openPairJudge } from "../semantic/pair-judge.js";
import type { FetchLike } from "../semantic/provider.js";
import { assertApiJudgeReady, createApiJudge, judgeModel } from "./llm.js";

/** A judge's reading of one pair. */
export type JudgedPair = {
  /** Probability of the same job. */
  score: number;
  /** same / contains / concept / pattern / different, when the judge names it. */
  label?: string;
  /** One sentence, when the judge gives one. */
  reason?: string;
};

export type PairJudge = {
  /** Provider, model and where it runs, e.g. `onnx:dustmap-pair-judge-private@0.1.0 (gpu)`, `anthropic:claude-…`. */
  readonly id: string;
  /** Score from which a pair counts as the same job. */
  readonly threshold: number;
  /** `null` for a pair the judge did not read (an API judge's pair budget was spent). */
  judge: (pairs: ReadonlyArray<readonly [string, string]>) => Promise<Array<JudgedPair | null>>;
  /** Distinct pairs since opening: read by the model, answered from the verdict cache, left unread by the budget. */
  readonly stats: { read: number; cached: number; skipped: number };
  release: () => Promise<void>;
};

/** The judge of a scan, or why there is none (`null` note: the user chose none). */
export type OpenedJudge = { judge: PairJudge | null; note: string | null };

export async function openJudge(
  cfg: JudgeConfig,
  opts: { modelDir?: string; outputDir: string; fetch?: FetchLike },
): Promise<OpenedJudge> {
  if (cfg.provider === "none") return { judge: null, note: null };
  if (cfg.provider === "onnx") {
    const id = judgeModel(cfg);
    try {
      const onnx = await openPairJudge(resolveModelDir({ modelDir: opts.modelDir }), id, { device: cfg.device });
      const judge = cachedJudge({
        id: `onnx:${onnx.manifest.id}@${onnx.manifest.version} (${onnx.variant})`,
        cacheKey: `onnx:${onnx.manifest.id}@${onnx.manifest.version}`,
        threshold: onnx.manifest.threshold,
        read: async (pairs) => (await onnx.score(pairs)).map((score) => ({ score })),
        budget: null,
        outputDir: opts.outputDir,
        release: () => onnx.release(),
      });
      return { judge, note: null };
    } catch (err) {
      if (err instanceof OnnxModelError && err.code === "onnx_model_missing") return { judge: null, note: `pair judge "${id}" is not installed` };
      throw err;
    }
  }
  assertApiJudgeReady(cfg);
  const api = createApiJudge(cfg, opts.fetch);
  const judge = cachedJudge({ id: api.id, cacheKey: api.id, threshold: 0.5, read: api.judge, budget: cfg.maxPairs, outputDir: opts.outputDir, release: async () => {} });
  return { judge, note: null };
}

/**
 * A judge with its verdict cache and pair budget: cached pairs cost nothing; of the rest at most
 * `budget` (null = all) are read per opening, the others come back `null`. The cache file is written
 * after every read, so a scan that fails half way keeps what it paid for.
 */
function cachedJudge(o: {
  id: string;
  cacheKey: string;
  threshold: number;
  read: (pairs: ReadonlyArray<readonly [string, string]>) => Promise<JudgedPair[]>;
  budget: number | null;
  outputDir: string;
  release: () => Promise<void>;
}): PairJudge {
  const file = path.join(o.outputDir, "cache", "judge", `${o.cacheKey.replace(/[^a-zA-Z0-9._@-]+/g, "_").slice(0, 96)}.json`);
  let cache: Record<string, JudgedPair> | null = null;
  const load = (): Record<string, JudgedPair> => {
    if (cache) return cache;
    try {
      cache = JSON.parse(readFileSync(file, "utf8")) as Record<string, JudgedPair>;
    } catch {
      // No cache yet, or a broken one: the pairs are read again.
      cache = {};
    }
    return cache;
  };
  let left = o.budget;
  const stats = { read: 0, cached: 0, skipped: 0 };
  return {
    id: o.id,
    threshold: o.threshold,
    stats,
    async judge(pairs) {
      const known = load();
      const keys = pairs.map(([a, b]) => createHash("sha256").update(`${a}\u0000${b}`).digest("hex").slice(0, 40));
      const distinct = [...new Set(keys)];
      const fresh = distinct.filter((k) => !known[k]);
      const take = left === null ? fresh : fresh.slice(0, Math.max(0, left));
      if (left !== null) left -= take.length;
      stats.cached += distinct.length - fresh.length;
      stats.read += take.length;
      stats.skipped += fresh.length - take.length;
      if (take.length > 0) {
        const byKey = new Map(keys.map((k, i) => [k, pairs[i]!] as const));
        const verdicts = await o.read(take.map((k) => byKey.get(k)!));
        take.forEach((k, i) => (known[k] = verdicts[i]!));
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, `${JSON.stringify(known)}\n`, "utf8");
      }
      return keys.map((k) => known[k] ?? null);
    },
    release: o.release,
  };
}

/**
 * The structured verdict of a group from its judged pairs: every pair the same job → real-duplicate,
 * none → intentional-pattern, a mix → uncertain. The reason is the judge's own sentence when it gave
 * one, else the count.
 */
export function groupJudgement(judgeId: string, threshold: number, verdicts: readonly JudgedPair[]): JudgementType {
  const yes = verdicts.filter((v) => v.score >= threshold).length;
  const verdict = yes === verdicts.length ? "real-duplicate" : yes === 0 ? "intentional-pattern" : "uncertain";
  const said = verdicts.find((v) => v.reason && v.reason !== v.label)?.reason;
  const count = `${yes} of ${verdicts.length} pairs read as the same job`;
  return { verdict, reason: said ? `${said} (${count})` : count, model: judgeId };
}
