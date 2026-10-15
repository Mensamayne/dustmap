import { describe, expect, it } from "vitest";
import { clusterDuplicates } from "./cluster.js";
import type { JscpdDuplicate } from "./types.js";

function pair(a: string, b: string, fragment: string, lines = 10): JscpdDuplicate {
  return {
    fragment,
    lines,
    firstFile: { name: a, start: 1, end: lines, startLoc: { line: 1, column: 0, position: 0 }, endLoc: { line: lines, column: 0, position: 0 } },
    secondFile: { name: b, start: 1, end: lines, startLoc: { line: 1, column: 0, position: 0 }, endLoc: { line: lines, column: 0, position: 0 } },
  };
}

describe("clusterDuplicates", () => {
  it("merges A≈B and A≈C into one cluster with three locations", () => {
    const fragment = "export function f() {\n  return 1 + 2 + 3;\n  return 4;\n  return 5;\n}";
    const findings = clusterDuplicates(
      [pair("src/a.ts", "src/b.ts", fragment), pair("src/a.ts", "src/c.ts", fragment)],
      (n) => n,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("clone-cluster");
    expect(findings[0]?.category).toBe("duplicate");
    expect(findings[0]?.locations.map((l) => l.path).sort()).toEqual([
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
    ]);
    expect(findings[0]?.confidence).toBe("high");
    expect(findings[0]?.evidence.find((e) => e.label === "places")?.value).toBe("3");
  });

  it("fingerprints from content, not paths", () => {
    const fragment = "const x = 1;\nconst y = 2;\nconst z = 3;\nconst w = 4;\n";
    const a = clusterDuplicates([pair("one.ts", "two.ts", fragment)], (n) => n);
    const b = clusterDuplicates([pair("alpha.ts", "beta.ts", fragment)], (n) => n);
    expect(a[0]?.fingerprint).toBe(b[0]?.fingerprint);
  });
});
