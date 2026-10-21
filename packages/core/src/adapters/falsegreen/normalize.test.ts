/**
 * Normalize unit tests — recorded falsegreen JSON → Dustmap findings (allowlist + .tmp drop).
 */
import { describe, expect, it } from "vitest";
import { normalizeFalsegreenReport, pathHasTmpSegment } from "./normalize.js";
import type { FalsegreenJsonReport } from "./types.js";

const source = "falsegreen@0.7.0+dm1";

const sample: FalsegreenJsonReport = {
  tool: "falsegreen-js",
  version: "0.7.0",
  findings: [
    {
      file: "/repo/src/sum.weak.test.ts",
      line: 7,
      code: "C5",
      detail: "both sides are the same literal",
      confidence: "high",
      title: "always-true check (expect(true).toBe(true), assert(1))",
      level: "unit",
      snippet: 'it("claims to check addition but asserts a constant", () => {',
      fix: "assert the real behaviour, not a constant or tautology",
    },
    {
      file: "/repo/src/noise.test.ts",
      line: 10,
      code: "C16",
      detail: "reads the system clock",
      confidence: "low",
      title: "result depends on time, randomness or a fixed timer",
      level: "unit",
    },
    {
      file: "/repo/.tmp/scratch.test.ts",
      line: 3,
      code: "C5",
      detail: "both sides are the same literal",
      confidence: "high",
      title: "always-true check",
      level: "unit",
      snippet: "expect(true).toBe(true);",
    },
    {
      file: "/repo/src/weak-defined.test.ts",
      line: 4,
      code: "C6",
      detail: "only checks the value is present",
      confidence: "low",
      title: "weak check",
      level: "unit",
      snippet: "expect(x).toBeDefined();",
    },
  ],
};

describe("normalizeFalsegreenReport", () => {
  it("keeps allowlisted C5 high and C6 as medium; drops C16 and .tmp", () => {
    const findings = normalizeFalsegreenReport(sample, {
      source,
      resolvePath: (p) => p.replace(/^\/repo\//, ""),
    });
    expect(findings.map((f) => f.evidence.find((e) => e.label === "code")?.value)).toEqual([
      "C5",
      "C6",
    ]);
    expect(findings[0]?.kind).toBe("false-green-test");
    expect(findings[0]?.category).toBe("refactor-signal");
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.locations[0]?.path).toBe("src/sum.weak.test.ts");
    expect(findings[1]?.confidence).toBe("medium");
  });

  it("includeLow false keeps only tool-high", () => {
    const findings = normalizeFalsegreenReport(sample, {
      source,
      includeLow: false,
      resolvePath: (p) => p.replace(/^\/repo\//, ""),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.confidence).toBe("high");
  });

  it("pathHasTmpSegment detects scratch segments", () => {
    expect(pathHasTmpSegment("monorepo-a-web/.tmp/x.test.ts")).toBe(true);
    expect(pathHasTmpSegment("src/sum.test.ts")).toBe(false);
  });
});
