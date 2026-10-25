/**
 * A pair judge behind an API (V1-01): any OpenAI-compatible chat endpoint (OpenAI, a local vLLM /
 * Ollama / llama.cpp server) or the Anthropic Messages API. The model reads both code pieces and
 * answers with a label (same / contains / concept / pattern / different), its confidence and one
 * sentence of reason; the label and confidence become the probability of the same job, the scale every
 * judge shares. Keys come only from the environment; a non-loopback URL needs `judge.allowRemote`.
 * The verdict cache and the per-scan pair budget wrap every judge alike (judge.ts).
 */
import type { JudgeConfig } from "../config/schema.js";
import { isLoopbackUrl, type FetchLike } from "../semantic/provider.js";
import type { JudgedPair } from "./judge.js";

export class JudgeConfigError extends Error {
  readonly code = "judge_config";
  constructor(message: string) {
    super(message);
    this.name = "JudgeConfigError";
  }
}

export class JudgeRemoteForbiddenError extends Error {
  readonly code = "judge_remote_forbidden";
  constructor(url: string) {
    super(`Judge URL is not loopback (${url}). Set judge.allowRemote: true to send code pairs off this machine.`);
    this.name = "JudgeRemoteForbiddenError";
  }
}

const LABELS = ["same", "contains", "concept", "pattern", "different"] as const;
type Label = (typeof LABELS)[number];
const POSITIVE = new Set<Label>(["same", "contains", "concept"]);
/** Characters of each side sent to the model; longer code is cut, as the local judge cuts tokens. */
const MAX_SIDE_CHARS = 6000;

export const PAIR_PROMPT = `You compare two pieces of code from one repository and decide whether they do the same job.
Labels:
- "same": the same job, maybe with other names, formatting or small differences;
- "contains": one does the other's job and more (an extended copy);
- "concept": the same idea implemented differently;
- "pattern": the same structure or skeleton, but a different job (other data, another responsibility);
- "different": unrelated work.
Reply with ONLY a JSON object: {"label":"…","confidence":0.0-1.0,"reason":"one short sentence"}.
Never suggest how to rewrite the code.`;

export function judgeApiKey(): string {
  return process.env.DUSTMAP_JUDGE_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim() || "";
}

function endpoint(cfg: JudgeConfig): string {
  if (cfg.provider === "anthropic") {
    const base = (cfg.url ?? "https://api.anthropic.com").replace(/\/$/, "");
    return /\/v1\/messages$/i.test(base) ? base : `${base}/v1/messages`;
  }
  const base = (cfg.url ?? "https://api.openai.com/v1").replace(/\/$/, "");
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

/** Check an API judge can run before any request: a model name, a key, and the remote rule. */
export function assertApiJudgeReady(cfg: JudgeConfig, defaultModel: string): void {
  if (cfg.model === defaultModel) {
    throw new JudgeConfigError(`judge.provider is "${cfg.provider}" but judge.model is still the local package "${defaultModel}" — set the API model name.`);
  }
  const url = endpoint(cfg);
  const local = isLoopbackUrl(url);
  if (!judgeApiKey() && !local) {
    throw new JudgeConfigError(`judge.provider is "${cfg.provider}" but no API key is set: export DUSTMAP_JUDGE_API_KEY (or OPENAI_API_KEY / ANTHROPIC_API_KEY).`);
  }
  if (!cfg.allowRemote && !local) throw new JudgeRemoteForbiddenError(url);
}

/** Label + confidence → probability of the same job. */
export function scoreOf(label: Label, confidence: number): number {
  const c = Math.min(1, Math.max(0, confidence));
  return POSITIVE.has(label) ? 0.5 + c / 2 : 0.5 - c / 2;
}

export function parsePairVerdict(raw: string): JudgedPair {
  const m = raw.trim().match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`Judge reply is not JSON: ${raw.trim().slice(0, 200)}`);
  const obj = JSON.parse(m[0]) as { label?: string; confidence?: unknown; reason?: unknown };
  const label = obj.label as Label;
  if (!LABELS.includes(label)) throw new Error(`Judge returned an unknown label: ${String(obj.label)}`);
  const confidence = typeof obj.confidence === "number" && Number.isFinite(obj.confidence) ? obj.confidence : 1;
  const reason = typeof obj.reason === "string" && obj.reason.trim() ? obj.reason.trim() : label;
  return { score: scoreOf(label, confidence), label, reason };
}

const cut = (code: string) => (code.length > MAX_SIDE_CHARS ? `${code.slice(0, MAX_SIDE_CHARS)}\n/* … cut */` : code);
const FENCE = "```";
const piece = (name: string, code: string) => [`Piece ${name}:`, FENCE, cut(code), FENCE].join("\n");
const userPrompt = (a: string, b: string) => `${piece("A", a)}\n\n${piece("B", b)}`;

export type ApiJudge = {
  readonly id: string;
  /** Requests made. */
  readonly requests: { count: number };
  /** One request per pair. */
  judge: (pairs: ReadonlyArray<readonly [string, string]>) => Promise<JudgedPair[]>;
};

export function createApiJudge(cfg: JudgeConfig, fetchImpl: FetchLike = fetch as FetchLike): ApiJudge {
  const url = endpoint(cfg);
  const key = judgeApiKey();
  const requests = { count: 0 };
  const ask = async (a: string, b: string): Promise<JudgedPair> => {
    requests.count += 1;
    const res =
      cfg.provider === "anthropic"
        ? await fetchImpl(url, {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({ model: cfg.model, max_tokens: 200, system: PAIR_PROMPT, messages: [{ role: "user", content: userPrompt(a, b) }] }),
          })
        : await fetchImpl(url, {
            method: "POST",
            headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
            body: JSON.stringify({
              model: cfg.model,
              temperature: 0,
              max_tokens: 200,
              messages: [
                { role: "system", content: PAIR_PROMPT },
                { role: "user", content: userPrompt(a, b) },
              ],
            }),
          });
    if (!res.ok) throw new Error(`Judge ${cfg.provider} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }>; choices?: Array<{ message?: { content?: string } }> };
    const text = cfg.provider === "anthropic" ? (json.content?.find((c) => c.type === "text")?.text ?? "") : (json.choices?.[0]?.message?.content ?? "");
    return parsePairVerdict(text);
  };
  return {
    id: `${cfg.provider}:${cfg.model}`,
    requests,
    async judge(pairs) {
      const out: JudgedPair[] = [];
      for (const [a, b] of pairs) out.push(await ask(a, b));
      return out;
    },
  };
}
