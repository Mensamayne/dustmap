/**
 * The pair judge (V1-01): every provider through one interface; API judges on recorded replies (no
 * network), their cache and pair budget; keys only from the environment; remote only when allowed.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/load.js";
import { DustmapConfig, formatConfigError, type JudgeConfig } from "../src/config/schema.js";
import {
  assertApiJudgeReady,
  createApiJudge,
  groupJudgement,
  JudgeConfigError,
  JudgeRemoteForbiddenError,
  openJudge,
  parsePairVerdict,
  scoreOf,
} from "../src/judge/index.js";
import type { FetchLike } from "../src/semantic/provider.js";
import { clusterSemanticPairs } from "../src/semantic/cluster.js";
import { semanticAdapter } from "../src/semantic/run.js";

const KEYS = ["DUSTMAP_JUDGE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

const cfg = (over: Partial<JudgeConfig>): JudgeConfig => ({ ...defaultConfig().judge, ...over });
const out = () => mkdtempSync(path.join(tmpdir(), "dustmap-judge-"));

type Call = { url: string; headers: Record<string, string>; body: { model: string; messages?: Array<{ role: string; content: string }>; system?: string } };
function recorded(reply: (call: Call) => unknown): { fetch: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    const call = { url, headers: init?.headers ?? {}, body: JSON.parse(init?.body ?? "{}") };
    calls.push(call);
    const json = reply(call);
    return { ok: true, status: 200, text: async () => JSON.stringify(json), json: async () => json };
  };
  return { fetch: fetchImpl, calls };
}

describe("pair judge (V1-01)", () => {
  it("label and confidence become the shared probability scale", () => {
    expect(scoreOf("same", 1)).toBe(1);
    expect(scoreOf("contains", 0.5)).toBe(0.75);
    expect(scoreOf("pattern", 1)).toBe(0);
    expect(scoreOf("different", 0.2)).toBeCloseTo(0.4);
    expect(parsePairVerdict('Sure: {"label":"concept","confidence":0.8,"reason":"Both sum a list."}')).toEqual({ score: 0.9, label: "concept", reason: "Both sum a list." });
    expect(() => parsePairVerdict('{"label":"maybe"}')).toThrow(/unknown label/);
  });

  it("none is no judge; a missing package is a note, not an error", async () => {
    expect(await openJudge(cfg({ provider: "none" }), { outputDir: out() })).toEqual({ judge: null, note: null });
    const missing = await openJudge(cfg({ provider: "onnx", model: "no-such-judge" }), { modelDir: out(), outputDir: out() });
    expect(missing.judge).toBeNull();
    expect(missing.note).toBe('pair judge "no-such-judge" is not installed');
  });

  it("a config with the old judge keys fails and says where each setting moved", () => {
    const r = DustmapConfig.safeParse({ semantic: { pairJudge: "x", judgedMinBand: "high" }, judge: { enabled: true } });
    expect(r.success).toBe(false);
    const msg = formatConfigError(r.error!);
    expect(msg).toContain("pairJudge → judge.provider + judge.model");
    expect(msg).toContain("judgedMinBand → judge.minBand");
    expect(msg).toContain('enabled → judge.provider ("none" = no judge)');
  });

  it("a judge needs a model name; an API judge also a key for a remote API, and allowRemote", async () => {
    expect(() => assertApiJudgeReady(cfg({ provider: "openai" }))).toThrow(/judge.model is not set — name the API model/);
    await expect(openJudge(cfg({ provider: "onnx" }), { outputDir: out() })).rejects.toThrow(/name the judge package/);
    expect(() => assertApiJudgeReady(cfg({ provider: "openai", model: "gpt-x" }))).toThrow(JudgeConfigError);
    process.env.OPENAI_API_KEY = "test-key";
    expect(() => assertApiJudgeReady(cfg({ provider: "openai", model: "gpt-x" }))).toThrow(JudgeRemoteForbiddenError);
    expect(() => assertApiJudgeReady(cfg({ provider: "openai", model: "gpt-x", allowRemote: true }))).not.toThrow();
    delete process.env.OPENAI_API_KEY;
    // A local server (Ollama, vLLM) needs neither a key nor allowRemote.
    expect(() => assertApiJudgeReady(cfg({ provider: "openai", model: "qwen2.5-coder", url: "http://127.0.0.1:11434/v1" }))).not.toThrow();
  });

  it("OpenAI-compatible: both pieces of code go in the prompt; verdicts are cached; the pair budget holds", async () => {
    process.env.DUSTMAP_JUDGE_API_KEY = "test-key";
    const rec = recorded(() => ({ choices: [{ message: { content: '{"label":"same","confidence":0.9,"reason":"Same loop, other names."}' } }] }));
    const dir = out();
    const c = cfg({ provider: "openai", model: "gpt-x", url: "http://127.0.0.1:9/v1", maxPairs: 2 });
    const open = async () => (await openJudge(c, { outputDir: dir, fetch: rec.fetch })).judge!;
    const judge = await open();
    expect(judge.id).toBe("openai:gpt-x");
    const first = await judge.judge([["function a() { return 1; }", "function b() { return 1; }"]]);
    expect(first).toEqual([{ score: 0.95, label: "same", reason: "Same loop, other names." }]);
    expect(rec.calls[0]!.url).toBe("http://127.0.0.1:9/v1/chat/completions");
    expect(rec.calls[0]!.headers.authorization).toBe("Bearer test-key");
    expect(rec.calls[0]!.body.messages![1]!.content).toContain("function a() { return 1; }");
    expect(rec.calls[0]!.body.messages![1]!.content).toContain("function b() { return 1; }");
    // Cached: a fresh judge on the same outputDir asks nothing for that pair.
    const again = await open();
    expect(await again.judge([["function a() { return 1; }", "function b() { return 1; }"]])).toEqual(first);
    expect(rec.calls).toHaveLength(1);
    // Budget 2 new pairs per scan: the third is not read; a repeated pair is read once.
    const three = await again.judge([
      ["x1", "y1"],
      ["x2", "y2"],
      ["x1", "y1"],
      ["x3", "y3"],
    ]);
    expect(three.map((v) => v === null)).toEqual([false, false, false, true]);
    expect(rec.calls).toHaveLength(3);
    expect(again.stats).toEqual({ read: 2, cached: 1, skipped: 1 });
  });

  it("Anthropic: Messages API with x-api-key, system prompt and the verdict from the text block", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const rec = recorded(() => ({ content: [{ type: "text", text: '{"label":"pattern","confidence":1,"reason":"Same shape, other data."}' }] }));
    const judge = createApiJudge(cfg({ provider: "anthropic", model: "claude-x", allowRemote: true }), rec.fetch);
    const [v] = await judge.judge([["const a = 1;", "const b = 2;"]]);
    expect(v).toEqual({ score: 0, label: "pattern", reason: "Same shape, other data." });
    expect(rec.calls[0]!.url).toBe("https://api.anthropic.com/v1/messages");
    expect(rec.calls[0]!.headers["x-api-key"]).toBe("test-key");
    expect(rec.calls[0]!.body.system).toContain("same job");
  });

  it("the semantic adapter's cache key changes with the embedding model and the judge", () => {
    const base = defaultConfig();
    const v = (over: Partial<typeof base>) => semanticAdapter().version({ ...base, ...over });
    const now = v({});
    expect(v({ semantic: { ...base.semantic, model: "other-embedding" } })).not.toBe(now);
    expect(v({ judge: { ...base.judge, provider: "onnx" } })).not.toBe(now);
    expect(v({ judge: { ...base.judge, provider: "anthropic", model: "claude-x" } })).not.toBe(now);
    expect(v({})).toBe(now);
  });

  it("a semantic group carries the judge's structured verdict", () => {
    const fn = (p: string, name: string) => ({ path: p, name, startLine: 1, endLine: 9, body: `function ${name}(){ return 1 }` });
    const [g] = clusterSemanticPairs([{ a: fn("a.ts", "a"), b: fn("b.ts", "b"), similarity: 0.9, judged: { score: 0.95, reason: "Same job." } }], 0.8, null, null, {
      id: "anthropic:claude-x",
      threshold: 0.5,
      minBand: "medium",
    });
    expect(g!.judgement).toEqual({ verdict: "real-duplicate", reason: "Same job. (1 of 1 pairs read as the same job)", model: "anthropic:claude-x" });
  });

  it("a group's verdict: all same → real-duplicate, none → intentional-pattern, a mix → uncertain", () => {
    expect(groupJudgement("j", 0.5, [{ score: 0.9, reason: "Same." }]).verdict).toBe("real-duplicate");
    expect(groupJudgement("j", 0.5, [{ score: 0.1 }, { score: 0.2 }])).toEqual({ verdict: "intentional-pattern", reason: "0 of 2 pairs read as the same job", model: "j" });
    expect(groupJudgement("j", 0.5, [{ score: 0.9 }, { score: 0.1 }]).verdict).toBe("uncertain");
  });
});
