/**
 * Map metrics and repeated conditions into Dustmap Findings. Category is always refactor-signal.
 * Verify hints say only “review” — never how to reshape the code.
 */
import { fingerprint, type FindingType } from "@dustmap/contract";
import type { FileMetrics } from "./metrics.js";
import type { RepeatedCondition } from "./repeated-conditions.js";
import type { CodeSignalThresholds } from "./thresholds.js";

const SOURCE = "code-signals";
const REVIEW_HINT = "Review this spot with the surrounding module; no automatic change suggested.";

const FORBIDDEN_HINT =
  /\b(extract|split into|refactor into|pull out|break into|move to)\b/i;

export function assertNoPrescription(text: string): void {
  if (FORBIDDEN_HINT.test(text)) {
    throw new Error(`code-signal text must not prescribe a refactor: ${text}`);
  }
}

function complexityFinding(
  filePath: string,
  name: string,
  startLine: number,
  endLine: number,
  label: string,
  value: number,
  threshold: number,
  bodySnippet: string,
): FindingType {
  const evidence = [
    { label, value: String(value) },
    { label: "threshold", value: String(threshold) },
    { label: "function", value: name },
  ];
  assertNoPrescription(REVIEW_HINT);
  const fp = fingerprint("complexity", [bodySnippet || `${filePath}:${name}:${label}`], [name, label]);
  return {
    fingerprint: fp,
    kind: "complexity",
    category: "refactor-signal",
    locations: [{ path: filePath, startLine, endLine, symbol: name }],
    evidence,
    confidence: value >= threshold * 2 ? "high" : value >= threshold * 1.4 ? "medium" : "low",
    suggestedAction: "review",
    verifyHint: REVIEW_HINT,
    source: SOURCE,
  };
}

/** Convert file metrics that exceed thresholds into findings. */
export function metricsToFindings(
  files: readonly FileMetrics[],
  thresholds: CodeSignalThresholds,
): FindingType[] {
  const out: FindingType[] = [];

  for (const file of files) {
    if (file.lines >= thresholds.maxFileLines) {
      const fp = fingerprint("large-file", [`lines:${file.lines}`, file.path], [file.path]);
      out.push({
        fingerprint: fp,
        kind: "large-file",
        category: "refactor-signal",
        locations: [{ path: file.path, startLine: 1 }],
        evidence: [
          { label: "lines", value: String(file.lines) },
          { label: "threshold", value: String(thresholds.maxFileLines) },
        ],
        confidence:
          file.lines >= thresholds.maxFileLines * 2
            ? "high"
            : file.lines >= thresholds.maxFileLines * 1.4
              ? "medium"
              : "low",
        suggestedAction: "review",
        verifyHint: REVIEW_HINT,
        source: SOURCE,
      });
    }

    for (const fn of file.functions) {
      const snippet = `${fn.name}:${fn.startLine}:${fn.cyclomatic}:${fn.cognitive}`;
      if (fn.cyclomatic >= thresholds.cyclomatic) {
        out.push(
          complexityFinding(
            file.path,
            fn.name,
            fn.startLine,
            fn.endLine,
            "cyclomatic",
            fn.cyclomatic,
            thresholds.cyclomatic,
            snippet,
          ),
        );
      }
      if (fn.cognitive >= thresholds.cognitive) {
        out.push(
          complexityFinding(
            file.path,
            fn.name,
            fn.startLine,
            fn.endLine,
            "cognitive",
            fn.cognitive,
            thresholds.cognitive,
            snippet + ":cog",
          ),
        );
      }
      if (fn.maxNesting >= thresholds.maxNesting) {
        out.push(
          complexityFinding(
            file.path,
            fn.name,
            fn.startLine,
            fn.endLine,
            "nesting",
            fn.maxNesting,
            thresholds.maxNesting,
            snippet + ":nest",
          ),
        );
      }
      if (fn.lines >= thresholds.maxFunctionLines) {
        out.push(
          complexityFinding(
            file.path,
            fn.name,
            fn.startLine,
            fn.endLine,
            "function-lines",
            fn.lines,
            thresholds.maxFunctionLines,
            snippet + ":lines",
          ),
        );
      }
      if (fn.paramCount >= thresholds.maxParams) {
        const fp = fingerprint(
          "long-parameter-list",
          [`params:${fn.paramCount}`, fn.name],
          [fn.name],
        );
        out.push({
          fingerprint: fp,
          kind: "long-parameter-list",
          category: "refactor-signal",
          locations: [
            { path: file.path, startLine: fn.startLine, endLine: fn.endLine, symbol: fn.name },
          ],
          evidence: [
            { label: "params", value: String(fn.paramCount) },
            { label: "threshold", value: String(thresholds.maxParams) },
          ],
          confidence: fn.paramCount >= thresholds.maxParams + 3 ? "high" : "medium",
          suggestedAction: "review",
          verifyHint: REVIEW_HINT,
          source: SOURCE,
        });
      }
      if (fn.booleanParamCount >= thresholds.maxBooleanParams) {
        const fp = fingerprint(
          "boolean-params",
          [`boolParams:${fn.booleanParamCount}`, fn.name],
          [fn.name],
        );
        out.push({
          fingerprint: fp,
          kind: "boolean-params",
          category: "refactor-signal",
          locations: [
            { path: file.path, startLine: fn.startLine, endLine: fn.endLine, symbol: fn.name },
          ],
          evidence: [
            { label: "boolean-params", value: String(fn.booleanParamCount) },
            { label: "threshold", value: String(thresholds.maxBooleanParams) },
          ],
          confidence: "medium",
          suggestedAction: "review",
          verifyHint: REVIEW_HINT,
          source: SOURCE,
        });
      }
    }
  }

  return out;
}

/** Convert repeated literal conditions into findings (kind: repeated-condition). */
export function repeatedConditionsToFindings(
  repeated: readonly RepeatedCondition[],
): FindingType[] {
  return repeated.map((r) => {
    const fp = fingerprint(
      "repeated-condition",
      [r.key],
      r.locations.map((l) => l.path),
    );
    assertNoPrescription(REVIEW_HINT);
    return {
      fingerprint: fp,
      kind: "repeated-condition" as const,
      category: "refactor-signal" as const,
      locations: r.locations.map((l) => ({
        path: l.path,
        startLine: l.startLine,
        symbol: r.key.slice(0, 80),
      })),
      evidence: [
        { label: "condition", value: r.key },
        { label: "files", value: String(r.locations.length) },
        { label: "example", value: r.locations[0]?.snippet ?? r.key },
      ],
      confidence: r.locations.length >= 8 ? "high" : r.locations.length >= 6 ? "medium" : "low",
      suggestedAction: "review" as const,
      verifyHint: REVIEW_HINT,
      source: SOURCE,
    };
  });
}

/** True when a finding's human-facing strings stay prescription-free. */
export function findingIsPrescriptionFree(f: FindingType): boolean {
  const blob = [f.verifyHint, ...f.evidence.map((e) => `${e.label} ${e.value}`)].join("\n");
  return !FORBIDDEN_HINT.test(blob) && f.suggestedAction === "review";
}
