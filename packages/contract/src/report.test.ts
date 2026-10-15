import { describe, expect, it } from "vitest";
import { Finding } from "./finding.js";
import { fingerprint } from "./fingerprint.js";
import { Report } from "./report.js";

function sampleFinding() {
  const fp = fingerprint("unused-export", ["export const x = 1"], ["x"]);
  return Finding.parse({
    fingerprint: fp,
    kind: "unused-export",
    category: "dead-code",
    locations: [{ path: "packages/app/src/x.ts", startLine: 1, symbol: "x" }],
    evidence: [{ label: "export", value: "x" }],
    confidence: "medium",
    suggestedAction: "decide",
    verifyHint: "Delete the export and typecheck the package.",
    source: "knip",
  });
}

describe("Report", () => {
  it("parses a v1 report", () => {
    const finding = sampleFinding();
    const report = Report.parse({
      schema: "dustmap.report/v1",
      scan: {
        mode: "full",
        commit: "abc1234",
        startedAt: "2026-10-15T12:00:00.000Z",
        tools: [{ name: "knip", version: "5.0.0" }],
      },
      summary: {
        byCategory: { "dead-code": 1 },
        topPlaces: [
          {
            path: "packages/app/src/x.ts",
            score: 1,
            findingFingerprints: [finding.fingerprint],
          },
        ],
      },
      findings: [finding],
    });
    expect(report.findings).toHaveLength(1);
  });

  it("rejects topPlace path with backslash", () => {
    const finding = sampleFinding();
    const result = Report.safeParse({
      schema: "dustmap.report/v1",
      scan: {
        mode: "diff",
        commit: "abc1234",
        baseRef: "main",
        startedAt: "2026-10-15T12:00:00.000Z",
        tools: [{ name: "knip", version: "5.0.0" }],
      },
      summary: {
        byCategory: {},
        topPlaces: [
          {
            path: "src\\bad.ts",
            score: 1,
            findingFingerprints: [finding.fingerprint],
          },
        ],
      },
      findings: [],
    });
    expect(result.success).toBe(false);
  });
});
