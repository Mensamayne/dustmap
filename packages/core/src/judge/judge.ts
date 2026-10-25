/**
 * One pair judge for the whole scan (V1-01, layer L4), whatever runs it: a Dustmap model package
 * (ONNX, CPU or GPU), an OpenAI-compatible API, the Anthropic API — or none. Every judge reads both
 * pieces of a pair and returns the probability that they do the same job, compared with its threshold.
 * `openJudge` builds it from `judge` config; a package that is not installed is a note, not an error
 * (the scan falls back to similarity alone and says so); a broken setup (no API key for a remote API,
 * remote without allowRemote, a damaged package) is an error. The scan opens the judge once and
 * releases it at the end.
 */
import type { JudgementType } from "@dustmap/contract";
import type { JudgeConfig } from "../config/schema.js";
import { OnnxModelError, resolveModelDir } from "../semantic/onnx-provider.js";
import { openPairJudge } from "../semantic/pair-judge.js";
import type { FetchLike } from "../semantic/provider.js";
import { assertApiJudgeReady, createApiJudge } from "./llm.js";

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
  release: () => Promise<void>;
};

/** The judge of a scan, or why there is none (`null` note: the user chose none). */
export type OpenedJudge = { judge: PairJudge | null; note: string | null };

/** The package id a fresh config names; an API judge must name its own model instead. */
export const DEFAULT_JUDGE_PACKAGE = "dustmap-pair-judge-private";

export async function openJudge(
  cfg: JudgeConfig,
  opts: { modelDir?: string; outputDir: string; fetch?: FetchLike },
): Promise<OpenedJudge> {
  if (cfg.provider === "none") return { judge: null, note: null };
  if (cfg.provider === "onnx") {
    try {
      const onnx = await openPairJudge(resolveModelDir({ modelDir: opts.modelDir }), cfg.model, { device: cfg.device });
      return {
        judge: {
          id: `onnx:${onnx.manifest.id}@${onnx.manifest.version} (${onnx.variant})`,
          threshold: onnx.manifest.threshold,
          judge: async (pairs) => (await onnx.score(pairs)).map((score) => ({ score })),
          release: () => onnx.release(),
        },
        note: null,
      };
    } catch (err) {
      if (err instanceof OnnxModelError && err.code === "onnx_model_missing") return { judge: null, note: `pair judge "${cfg.model}" is not installed` };
      throw err;
    }
  }
  assertApiJudgeReady(cfg, DEFAULT_JUDGE_PACKAGE);
  const api = createApiJudge(cfg, opts.outputDir, opts.fetch);
  return { judge: { id: api.id, threshold: 0.5, judge: api.judge, release: async () => {} }, note: null };
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
