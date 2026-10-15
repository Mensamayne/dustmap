import { describe, expect, it } from "vitest";
import { normalizeKnipReport } from "./normalize.js";
import type { KnipJsonReport } from "./types.js";

describe("normalizeKnipReport", () => {
  it("marks a name mentioned in a string as low confidence", () => {
    const report: KnipJsonReport = {
      issues: [
        {
          file: "src/loaded-by-name.ts",
          files: [{ name: "src/loaded-by-name.ts" }],
        },
      ],
    };
    const findings = normalizeKnipReport(report, {
      scannedFiles: new Set(["src/loaded-by-name.ts", "src/index.ts"]),
      roles: new Map([["src/loaded-by-name.ts", "source"], ["src/index.ts", "source"]]),
      mentionTexts: [`const plugin = "loaded-by-name";`],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("unused-file");
    expect(findings[0]?.confidence).toBe("low");
    expect(findings[0]?.evidence.some((e) => e.label === "name-mentions" && e.value === "1")).toBe(
      true,
    );
  });

  it("keeps high confidence when the name never appears in a string", () => {
    const report: KnipJsonReport = {
      issues: [
        {
          file: "src/dead.ts",
          files: [{ name: "src/dead.ts" }],
        },
        {
          file: "src/used.ts",
          exports: [{ name: "unusedExport", line: 2 }],
          types: [{ name: "UnusedType", line: 3 }],
        },
        {
          file: "package.json",
          dependencies: [{ name: "left-pad" }],
        },
      ],
    };
    const findings = normalizeKnipReport(report, {
      scannedFiles: new Set(["src/dead.ts", "src/used.ts"]),
      roles: new Map([
        ["src/dead.ts", "source"],
        ["src/used.ts", "source"],
      ]),
      mentionTexts: [`export const used = 1;`],
    });
    const byKind = Object.fromEntries(findings.map((f) => [f.kind + ":" + (f.locations[0]?.symbol ?? f.locations[0]?.path), f]));
    expect(byKind["unused-file:dead"]?.confidence).toBe("high");
    expect(byKind["unused-export:unusedExport"]?.confidence).toBe("high");
    expect(byKind["unused-type:UnusedType"]?.confidence).toBe("high");
    expect(byKind["unused-dependency:left-pad"]?.confidence).toBe("high");
  });

  it("drops findings for blocked roles", () => {
    const report: KnipJsonReport = {
      issues: [{ file: "dist/out.js", files: [{ name: "dist/out.js" }] }],
    };
    const findings = normalizeKnipReport(report, {
      scannedFiles: new Set(["dist/out.js"]),
      roles: new Map([["dist/out.js", "generated"]]),
      mentionTexts: [],
    });
    expect(findings).toEqual([]);
  });
});
