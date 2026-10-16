/**
 * Attach optional LLM judgements to duplicate clusters and top-ranked places.
 * Never mutates confidence, suggestedAction, or ranking scores — informational only.
 * Never enqueues tasks or writes into the scanned repo (cache lives under outputDir only).
 */
import type { FindingType, ReportSummaryType } from "@dustmap/contract";
import type { JudgeConfig } from "../config/schema.js";
import { readJudgeCache, writeJudgeCache } from "./cache.js";
import {
  assertJudgeReady,
  createJudgeProvider,
  type JudgeProvider,
} from "./provider.js";

const CLUSTER_KINDS = new Set(["clone-cluster", "semantic-cluster"]);

export type AnnotateJudgeOptions = {
  findings: readonly FindingType[];
  summary: ReportSummaryType;
  config: JudgeConfig;
  outputDir: string;
  /** Injected provider (recorded responses in tests). When omitted and enabled, builds from config. */
  provider?: JudgeProvider;
};

function selectCandidates(
  findings: readonly FindingType[],
  summary: ReportSummaryType,
  limit: number,
): FindingType[] {
  const byFp = new Map(findings.map((f) => [f.fingerprint, f]));
  const selected: FindingType[] = [];
  const seen = new Set<string>();

  const push = (f: FindingType | undefined) => {
    if (!f || seen.has(f.fingerprint) || selected.length >= limit) return;
    seen.add(f.fingerprint);
    selected.push(f);
  };

  for (const f of findings) {
    if (CLUSTER_KINDS.has(f.kind)) push(f);
  }
  for (const place of summary.topPlaces) {
    for (const fp of place.findingFingerprints) {
      push(byFp.get(fp));
    }
  }
  return selected;
}

function buildPrompt(finding: FindingType): string {
  const locs = finding.locations
    .slice(0, 8)
    .map((l) => {
      const range =
        l.startLine !== undefined
          ? `:${l.startLine}${l.endLine !== undefined ? `-${l.endLine}` : ""}`
          : "";
      const sym = l.symbol ? ` (${l.symbol})` : "";
      return `- ${l.path}${range}${sym}`;
    })
    .join("\n");
  const evidence = finding.evidence
    .slice(0, 12)
    .map((e) => `- ${e.label}: ${e.value}`)
    .join("\n");
  return [
    `kind: ${finding.kind}`,
    `category: ${finding.category}`,
    `confidence: ${finding.confidence}`,
    `fingerprint: ${finding.fingerprint}`,
    "locations:",
    locs || "- (none)",
    "evidence:",
    evidence || "- (none)",
  ].join("\n");
}

/** Rough completion-token estimate from response reason length. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Returns findings with `judgement` filled for selected candidates when judge.enabled.
 * When disabled, returns the input unchanged and never calls the provider.
 */
export async function annotateWithJudge(opts: AnnotateJudgeOptions): Promise<{
  findings: FindingType[];
  judged: number;
  requestCalls: number;
}> {
  const { findings, summary, config, outputDir } = opts;
  if (!config.enabled) {
    return { findings: [...findings], judged: 0, requestCalls: 0 };
  }

  // Injected providers (recorded fixtures) skip env/key gates; live providers assert first.
  const provider =
    opts.provider ??
    (() => {
      assertJudgeReady(config);
      return createJudgeProvider(config);
    })();
  const candidates = selectCandidates(findings, summary, config.maxClustersPerScan);
  const byFp = new Map(findings.map((f) => [f.fingerprint, { ...f }]));
  let judged = 0;
  let tokensUsed = 0;

  for (const candidate of candidates) {
    if (tokensUsed >= config.maxTokensBudget) break;

    const cached = readJudgeCache(outputDir, candidate.fingerprint, provider.modelId);
    if (cached) {
      const cur = byFp.get(candidate.fingerprint);
      if (cur) {
        byFp.set(candidate.fingerprint, { ...cur, judgement: cached });
        judged += 1;
      }
      continue;
    }

    const result = await provider.judge(buildPrompt(candidate));
    const judgement = { ...result, model: provider.modelId };
    writeJudgeCache(outputDir, candidate.fingerprint, judgement);
    tokensUsed += estimateTokens(result.reason);
    const cur = byFp.get(candidate.fingerprint);
    if (cur) {
      byFp.set(candidate.fingerprint, { ...cur, judgement });
      judged += 1;
    }
  }

  return {
    findings: findings.map((f) => byFp.get(f.fingerprint) ?? f),
    judged,
    requestCalls: provider.requestCalls.count,
  };
}
