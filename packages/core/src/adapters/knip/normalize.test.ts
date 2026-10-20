import { describe, expect, it } from "vitest";
import { normalizeKnipReport } from "./normalize.js";
import type { KnipJsonReport } from "./types.js";

const installed = () => ({ installed: true, scripts: "" });

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
      dependencyFacts: installed,
      manifestOf: () => "package.json",
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
      dependencyFacts: installed,
      manifestOf: () => "package.json",
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
      dependencyFacts: installed,
      manifestOf: () => "package.json",
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
      dependencyFacts: installed,
      manifestOf: () => "package.json",
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
      dependencyFacts: installed,
      manifestOf: () => "package.json",
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

describe("dependency verdicts without installed dependencies (BUG-10)", () => {
  const report: KnipJsonReport = {
    issues: [
      { file: "package.json", dependencies: [{ name: "next" }, { name: "left-pad" }] },
      { file: "packages/web/package.json", dependencies: [{ name: "left-pad" }] },
    ],
  };
  const run = (installed: boolean) =>
    normalizeKnipReport(report, {
      scannedFiles: new Set(),
      roles: new Map(),
      fileTexts: new Map(),
      dependencyFacts: () => ({ installed, scripts: "next dev\nnext build" }),
      manifestOf: () => "package.json",
    });

  it("caps every dependency verdict at low and says why when node_modules is missing", () => {
    const findings = run(false);
    expect(findings.every((f) => f.confidence === "low")).toBe(true);
    expect(findings.every((f) => f.evidence.some((e) => e.label === "dependencies-installed"))).toBe(true);
  });

  it("with dependencies installed, a package used as a script command is low, an unused one stays high", () => {
    const findings = run(true);
    const bySymbol = (name: string, manifest: string) =>
      findings.find((f) => f.locations[0]?.symbol === name && f.locations[0]?.path === manifest);
    expect(bySymbol("next", "package.json")?.confidence).toBe("low");
    expect(bySymbol("next", "package.json")?.evidence).toContainEqual({ label: "script-mentions", value: "2" });
    expect(bySymbol("left-pad", "package.json")?.confidence).toBe("high");
  });

  it("the same dependency in two manifests stays two findings", () => {
    const leftPads = run(true).filter((f) => f.locations[0]?.symbol === "left-pad");
    expect(leftPads.map((f) => f.locations[0]?.path).sort()).toEqual(["package.json", "packages/web/package.json"]);
    expect(new Set(leftPads.map((f) => f.fingerprint)).size).toBe(2);
  });
});

describe("unlisted dependencies are grouped per package and manifest (BUG-10)", () => {
  it("many importing files of one manifest → one finding; another manifest → its own", () => {
    const files = ["packages/web/src/a.ts", "packages/web/src/b.ts", "packages/web/src/c.ts", "packages/api/src/x.ts"];
    const report: KnipJsonReport = {
      issues: files.map((file, i) => ({ file, unlisted: [{ name: "zod", line: i + 1 }] })),
    };
    const findings = normalizeKnipReport(report, {
      scannedFiles: new Set(files),
      roles: new Map(files.map((f) => [f, "source"])),
      fileTexts: new Map(),
      dependencyFacts: () => ({ installed: true, scripts: "" }),
      manifestOf: (f) => `${f.split("/").slice(0, 2).join("/")}/package.json`,
    });
    expect(findings).toHaveLength(2);
    const web = findings.find((f) => f.evidence.some((e) => e.value === "packages/web/package.json"));
    expect(web?.locations.map((l) => l.path)).toEqual(["packages/web/src/a.ts", "packages/web/src/b.ts", "packages/web/src/c.ts"]);
    expect(web?.evidence).toContainEqual({ label: "importing-files", value: "3" });
    expect(new Set(findings.map((f) => f.fingerprint)).size).toBe(2);
  });
});
