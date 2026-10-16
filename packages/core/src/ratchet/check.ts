/**
 * Ratchet: list findings that are new vs baseline and meet the confidence floor.
 * Returns exitCode 1 when the new list is non-empty (CLI maps this to process exit).
 */
import type { Confidence, FindingType } from "@dustmap/contract";
import type { BaselineFile } from "./baseline.js";
import { loadBaseline, saveBaseline, BASELINE_SCHEMA_ID } from "./baseline.js";

const CONFIDENCE_RANK: Record<Confidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export type RatchetOptions = {
  /** Minimum confidence to consider (inclusive). Default medium. */
  minConfidence: Confidence;
};

export const DEFAULT_RATCHET_OPTIONS: RatchetOptions = {
  minConfidence: "medium",
};

export function parseRatchetOptions(raw: Record<string, unknown> | undefined): RatchetOptions {
  const src = raw ?? {};
  const mc = src.minConfidence;
  if (mc === "low" || mc === "medium" || mc === "high") {
    return { minConfidence: mc };
  }
  return { ...DEFAULT_RATCHET_OPTIONS };
}

export function meetsConfidenceFloor(confidence: Confidence, floor: Confidence): boolean {
  return CONFIDENCE_RANK[confidence] >= CONFIDENCE_RANK[floor];
}

export type RatchetResult = {
  /** Findings above the floor whose fingerprint is not in the baseline. */
  newFindings: FindingType[];
  /** 0 when clean, 1 when there is at least one new finding. */
  exitCode: 0 | 1;
  baselineSize: number;
};

export function checkRatchet(
  findings: readonly FindingType[],
  baseline: BaselineFile,
  options: RatchetOptions = DEFAULT_RATCHET_OPTIONS,
): RatchetResult {
  const known = new Set(baseline.fingerprints);
  const newFindings = findings.filter(
    (f) =>
      meetsConfidenceFloor(f.confidence, options.minConfidence) && !known.has(f.fingerprint),
  );
  return {
    newFindings,
    exitCode: newFindings.length > 0 ? 1 : 0,
    baselineSize: known.size,
  };
}

/**
 * Replace baseline with fingerprints of current findings that meet the confidence floor.
 * Never called implicitly from scan — only an explicit update.
 */
export function updateBaseline(
  outputDir: string,
  findings: readonly FindingType[],
  options: RatchetOptions = DEFAULT_RATCHET_OPTIONS,
): BaselineFile {
  const fingerprints = [
    ...new Set(
      findings
        .filter((f) => meetsConfidenceFloor(f.confidence, options.minConfidence))
        .map((f) => f.fingerprint),
    ),
  ].sort();
  const file: BaselineFile = {
    schema: BASELINE_SCHEMA_ID,
    fingerprints,
    updatedAt: new Date().toISOString(),
  };
  saveBaseline(outputDir, file);
  return file;
}

/** Load baseline from disk and compare. */
export function checkRatchetAt(
  outputDir: string,
  findings: readonly FindingType[],
  options: RatchetOptions = DEFAULT_RATCHET_OPTIONS,
): RatchetResult {
  return checkRatchet(findings, loadBaseline(outputDir), options);
}
