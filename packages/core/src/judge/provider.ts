/**
 * LLM judge providers — OpenAI-compatible chat or Anthropic Messages. Keys only from env.
 * Non-loopback URLs require judge.allowRemote. Disabled judge never constructs a provider.
 */
import {
  JudgementVerdict,
  type JudgementType,
  type JudgementVerdictType,
} from "@dustmap/contract";
import type { JudgeConfig } from "../config/schema.js";
import { isLoopbackUrl, type FetchLike } from "../semantic/provider.js";

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
    super(
      `Judge provider URL is not loopback (${url}). Set judge.allowRemote: true to send code snippets off this machine.`,
    );
    this.name = "JudgeRemoteForbiddenError";
  }
}

export type JudgeProvider = {
  readonly modelId: string;
  /** How many HTTP/model calls were made (tests assert 0 when judge.enabled is false). */
  readonly requestCalls: { count: number };
  judge: (userPrompt: string) => Promise<Omit<JudgementType, "model">>;
};

const VERDICT_SET = new Set<string>(JudgementVerdict.options);

function readApiKey(): string {
  return (
    process.env.DUSTMAP_JUDGE_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.ANTHROPIC_API_KEY?.trim() ||
    ""
  );
}

/** Require enabled judge to have an API key before any network call. */
export function assertJudgeReady(cfg: JudgeConfig): void {
  if (!cfg.enabled) return;
  if (!readApiKey()) {
    throw new JudgeConfigError(
      'judge.enabled is true but no API key is set. Export DUSTMAP_JUDGE_API_KEY (or OPENAI_API_KEY / ANTHROPIC_API_KEY).',
    );
  }
  const endpointUrl =
    cfg.url ??
    (cfg.provider === "anthropic" ? "https://api.anthropic.com" : "https://api.openai.com/v1");
  if (!cfg.allowRemote && !isLoopbackUrl(endpointUrl)) {
    throw new JudgeRemoteForbiddenError(endpointUrl);
  }
}

function parseVerdictPayload(raw: string): { verdict: JudgementVerdictType; reason: string } {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Judge response was not JSON: ${trimmed.slice(0, 200)}`);
  }
  const obj = JSON.parse(jsonMatch[0]) as { verdict?: string; reason?: string };
  if (!obj.verdict || !VERDICT_SET.has(obj.verdict)) {
    throw new Error(`Judge returned unknown verdict: ${String(obj.verdict)}`);
  }
  const reason = typeof obj.reason === "string" && obj.reason.trim() ? obj.reason.trim() : "";
  if (!reason) throw new Error("Judge returned an empty reason");
  return { verdict: obj.verdict as JudgementVerdictType, reason };
}

const SYSTEM_PROMPT = `You classify Dustmap findings (duplicate clusters or highly ranked code places).
Reply with ONLY a JSON object: {"verdict":"...","reason":"..."}.
verdict must be one of: "real-duplicate", "intentional-pattern", "uncertain".
reason: one short sentence in English explaining why. Never suggest deleting or rewriting code.`;

function openaiEndpoint(cfg: JudgeConfig): string {
  const base = (cfg.url ?? "https://api.openai.com/v1").replace(/\/$/, "");
  return /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
}

function anthropicEndpoint(cfg: JudgeConfig): string {
  const base = (cfg.url ?? "https://api.anthropic.com").replace(/\/$/, "");
  return /\/v1\/messages$/i.test(base) ? base : `${base}/v1/messages`;
}

export function createJudgeProvider(
  cfg: JudgeConfig,
  fetchImpl: FetchLike = fetch as FetchLike,
): JudgeProvider {
  assertJudgeReady(cfg);
  const key = readApiKey();
  const requestCalls = { count: 0 };
  const modelId = cfg.model;

  if (cfg.provider === "anthropic") {
    const endpoint = anthropicEndpoint(cfg);
    return {
      modelId,
      requestCalls,
      async judge(userPrompt: string) {
        requestCalls.count += 1;
        const res = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: modelId,
            max_tokens: 300,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Judge Anthropic HTTP ${res.status}: ${body.slice(0, 400)}`);
        }
        const json = (await res.json()) as {
          content?: Array<{ type?: string; text?: string }>;
        };
        const text = json.content?.find((c) => c.type === "text")?.text ?? "";
        return parseVerdictPayload(text);
      },
    };
  }

  const endpoint = openaiEndpoint(cfg);
  return {
    modelId,
    requestCalls,
    async judge(userPrompt: string) {
      requestCalls.count += 1;
      const headers: Record<string, string> = {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      };
      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: modelId,
          temperature: 0,
          max_tokens: 300,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Judge OpenAI HTTP ${res.status}: ${body.slice(0, 400)}`);
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      return parseVerdictPayload(text);
    },
  };
}

/** Build a provider that returns a fixed payload — for recorded-response tests (no network). */
export function createRecordingJudgeProvider(
  modelId: string,
  respond: (prompt: string) => Omit<JudgementType, "model"> | Promise<Omit<JudgementType, "model">>,
): JudgeProvider {
  const requestCalls = { count: 0 };
  return {
    modelId,
    requestCalls,
    async judge(userPrompt: string) {
      requestCalls.count += 1;
      return respond(userPrompt);
    },
  };
}
