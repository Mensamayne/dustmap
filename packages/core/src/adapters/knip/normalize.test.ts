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
      fileTexts: new Map([["src/index.ts", `const plugin = "loaded-by-name";`]]),
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
      fileTexts: new Map([["src/used.ts", `export const used = 1;`]]),
    });
    const byKind = Object.fromEntries(findings.map((f) => [f.kind + ":" + (f.locations[0]?.symbol ?? f.locations[0]?.path), f]));
    expect(byKind["unused-file:dead"]?.confidence).toBe("high");
    expect(byKind["unused-export:unusedExport"]?.confidence).toBe("high");
    expect(byKind["unused-type:UnusedType"]?.confidence).toBe("high");
    expect(byKind["unused-dependency:left-pad"]?.confidence).toBe("high");
  });

  it("never reports test data (fixture role) as dead code (BUG-06)", () => {
    const report: KnipJsonReport = {
      issues: [
        { file: "fixtures/app/src/leaf.ts", files: [{ name: "fixtures/app/src/leaf.ts" }] },
        { file: "fixtures/app/src/entry.ts", exports: [{ name: "fixtureEntry", line: 1 }] },
      ],
    };
    const findings = normalizeKnipReport(report, {
      scannedFiles: new Set(["fixtures/app/src/leaf.ts", "fixtures/app/src/entry.ts"]),
      roles: new Map([
        ["fixtures/app/src/leaf.ts", "fixture"],
        ["fixtures/app/src/entry.ts", "fixture"],
      ]),
      fileTexts: new Map(),
    });
    expect(findings).toEqual([]);
  });

  it("drops findings for blocked roles", () => {
    const report: KnipJsonReport = {
      issues: [{ file: "dist/out.js", files: [{ name: "dist/out.js" }] }],
    };
    const findings = normalizeKnipReport(report, {
      scannedFiles: new Set(["dist/out.js"]),
      roles: new Map([["dist/out.js", "generated"]]),
      fileTexts: new Map(),
    });
    expect(findings).toEqual([]);
  });
});

describe("dead-code fingerprints follow the code (BUG-08)", () => {
  const helper = (pad: string, body: string) =>
    `${pad}export function used(): number {\n  return 1;\n}\n\nexport function legacyFormatter(v: number): string {\n  return v.${body};\n}\n`;
  const fpOf = (text: string, kind: "unused-export" | "unused-file") => {
    const report: KnipJsonReport = {
      issues: [
        kind === "unused-export"
          ? { file: "src/helpers.ts", exports: [{ name: "legacyFormatter", line: 5 }] }
          : { file: "src/helpers.ts", files: [{ name: "src/helpers.ts" }] },
      ],
    };
    const [f] = normalizeKnipReport(report, {
      scannedFiles: new Set(["src/helpers.ts"]),
      roles: new Map([["src/helpers.ts", "source"]]),
      fileTexts: new Map([["src/helpers.ts", text]]),
    });
    return f!.fingerprint;
  };

  it("export: moving the code keeps the fingerprint, editing the body changes it", () => {
    const base = fpOf(helper("", "toFixed(3)"), "unused-export");
    expect(fpOf(helper("// note\n".repeat(10), "toFixed(3)"), "unused-export")).toBe(base);
    expect(fpOf(helper("", "toFixed(4)"), "unused-export")).not.toBe(base);
  });

  it("export: editing another symbol in the same file does not touch this fingerprint", () => {
    const base = fpOf(helper("", "toFixed(3)"), "unused-export");
    const otherEdited = helper("", "toFixed(3)").replace("return 1;", "return 2;");
    expect(fpOf(otherEdited, "unused-export")).toBe(base);
  });

  it("file: editing the file changes the fingerprint, reformatting does not", () => {
    const base = fpOf(helper("", "toFixed(3)"), "unused-file");
    expect(fpOf(helper("", "toFixed(3)").replace(/\n/g, "\n\n"), "unused-file")).toBe(base);
    expect(fpOf(helper("", "toFixed(4)"), "unused-file")).not.toBe(base);
  });
});
