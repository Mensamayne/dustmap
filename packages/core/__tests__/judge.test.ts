/**
 * LLM judge: disabled = zero requests; missing key = clear error; recorded response annotates.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { FindingType, ReportSummaryType } from "@dustmap/contract";
import { defaultConfig } from "../src/config/load.js";
import {
  annotateWithJudge,
  assertJudgeReady,
  createRecordingJudgeProvider,
  JudgeConfigError,
} from "../src/judge/index.js";
import { summarizeFindings, DEFAULT_RANKING_WEIGHTS } from "../src/rank/index.js";

function clusterFinding(fp: string): FindingType {
  return {
    fingerprint: fp,
    kind: "clone-cluster",
    category: "duplicate",
    locations: [
      { path: "src/a.ts", startLine: 1 },
      { path: "src/b.ts", startLine: 1 },
    ],
    evidence: [{ label: "tokens", value: "40" }],
    confidence: "high",
    suggestedAction: "review",
    verifyHint: "Review the shared block.",
    source: "jscpd",
  };
}

describe("judge provider gates", () => {
  it("enabled:false never requires a key and annotate makes zero requests", async () => {
    const cfg = { ...defaultConfig().judge, enabled: false };
    expect(() => assertJudgeReady(cfg)).not.toThrow();

    const provider = createRecordingJudgeProvider("rec", () => {
      throw new Error("should not be called");
    });
    const findings = [clusterFinding("aaaaaaaaaaaaaaaa")];
    const summary: ReportSummaryType = summarizeFindings(findings, DEFAULT_RANKING_WEIGHTS);
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-judge-off-"));
    const result = await annotateWithJudge({
      findings,
      summary,
      config: cfg,
      outputDir: out,
      provider,
    });
    expect(result.requestCalls).toBe(0);
    expect(result.judged).toBe(0);
    expect(result.findings[0]!.judgement).toBeUndefined();
    expect(provider.requestCalls.count).toBe(0);
  });

  it("enabled:true without API key throws a readable config error", () => {
    const prev = {
      dust: process.env.DUSTMAP_JUDGE_API_KEY,
      oai: process.env.OPENAI_API_KEY,
      ant: process.env.ANTHROPIC_API_KEY,
    };
    delete process.env.DUSTMAP_JUDGE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      expect(() =>
        assertJudgeReady({
          ...defaultConfig().judge,
          enabled: true,
          allowRemote: true,
          url: "https://api.openai.com/v1",
        }),
      ).toThrow(JudgeConfigError);
      expect(() =>
        assertJudgeReady({
          ...defaultConfig().judge,
          enabled: true,
          allowRemote: true,
        }),
      ).toThrow(/DUSTMAP_JUDGE_API_KEY/);
    } finally {
      if (prev.dust !== undefined) process.env.DUSTMAP_JUDGE_API_KEY = prev.dust;
      if (prev.oai !== undefined) process.env.OPENAI_API_KEY = prev.oai;
      if (prev.ant !== undefined) process.env.ANTHROPIC_API_KEY = prev.ant;
    }
  });
});

describe("judge annotate with recorded response", () => {
  it("attaches judgement without changing confidence", async () => {
    const findings = [clusterFinding("bbbbbbbbbbbbbbbb")];
    const confBefore = findings[0]!.confidence;
    const summary = summarizeFindings(findings, DEFAULT_RANKING_WEIGHTS);
    const provider = createRecordingJudgeProvider("recorded-model", () => ({
      verdict: "intentional-pattern",
      reason: "Shared test helper shape copied on purpose across fixtures.",
    }));
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-judge-rec-"));
    const result = await annotateWithJudge({
      findings,
      summary,
      config: {
        ...defaultConfig().judge,
        enabled: true,
        allowRemote: true,
        maxClustersPerScan: 5,
      },
      outputDir: out,
      provider,
    });
    expect(result.requestCalls).toBe(1);
    expect(result.findings[0]!.judgement).toEqual({
      verdict: "intentional-pattern",
      reason: "Shared test helper shape copied on purpose across fixtures.",
      model: "recorded-model",
    });
    expect(result.findings[0]!.confidence).toBe(confBefore);

    // Second pass hits cache — no new provider calls.
    const again = await annotateWithJudge({
      findings,
      summary,
      config: {
        ...defaultConfig().judge,
        enabled: true,
        allowRemote: true,
      },
      outputDir: out,
      provider,
    });
    expect(provider.requestCalls.count).toBe(1);
    expect(again.findings[0]!.judgement?.verdict).toBe("intentional-pattern");
  });
});
