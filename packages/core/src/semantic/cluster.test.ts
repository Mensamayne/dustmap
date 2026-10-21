import { describe, expect, it } from "vitest";
import { clusterSemanticPairs, cosineSimilarity, pairsAboveThreshold } from "./cluster.js";
import type { SemanticFunctionRef } from "./cluster.js";
import { pairsAtLeast } from "./similarity.js";

function fn(path: string, name: string, body: string, startLine = 1): SemanticFunctionRef {
  return { path, name, startLine, endLine: startLine + 9, body };
}

describe("semantic cluster", () => {
  it("merges A≈B and B≈C into one three-function cluster", () => {
    const a = fn("src/a.ts", "a", "function a(){ return 1 }");
    const b = fn("src/b.ts", "b", "function b(){ return 2 }");
    const c = fn("src/c.ts", "c", "function c(){ return 3 }");
    const findings = clusterSemanticPairs(
      [
        { a, b, similarity: 0.91 },
        { a: b, b: c, similarity: 0.88 },
      ],
      0.82,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("semantic-cluster");
    expect(findings[0]?.locations).toHaveLength(3);
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.evidence.find((e) => e.label === "shape")?.value).toBe("copies: 3 functions");
  });

  it("several separate pairs between the same two files are one finding: two parallel systems", () => {
    const pairs = ["load", "save", "remove"].map((n, k) => ({
      a: fn("src/store-a.ts", `${n}A`, `function ${n}A(){}`, k * 20 + 1),
      b: fn("src/store-b.ts", `${n}B`, `function ${n}B(){}`, k * 20 + 1),
      similarity: 0.9 - k * 0.02,
    }));
    const other = { a: fn("src/x.ts", "x", "function x(){}"), b: fn("src/y.ts", "y", "function y(){}"), similarity: 0.95 };
    const findings = clusterSemanticPairs([...pairs, other], 0.82);
    expect(findings).toHaveLength(2);
    const parallel = findings.find((f) => f.locations.length === 6)!;
    expect(new Set(parallel.locations.map((l) => l.path))).toEqual(new Set(["src/store-a.ts", "src/store-b.ts"]));
    expect(parallel.evidence.find((e) => e.label === "shape")?.value).toBe("parallel files: 3 matching function pairs between 2 files");
    expect(parallel.evidence.find((e) => e.label === "similarity-min")?.value).toBe("0.860");
    expect(findings.find((f) => f.locations.length === 2)?.evidence.find((e) => e.label === "shape")?.value).toBe("copies: 2 functions");
  });

  it("builds pairs from vectors above threshold (vectors normalised)", async () => {
    const fns = [fn("a.ts", "a", "aaa"), fn("b.ts", "b", "bbb"), fn("c.ts", "c", "ccc")];
    const vectors = [
      [1, 0, 0],
      [0.99, 0.1, 0],
      [0, 1, 0],
    ];
    const pairs = await pairsAboveThreshold(fns, vectors, 0.9);
    expect(pairs.length).toBe(1);
    expect(pairs[0]?.a.name).toBe("a");
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
  });

  it("finds every pair on large sets too (matrix path), same as the plain loop", async () => {
    let seed = 7;
    const r = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) - 0.5;
    const unit = (v: number[]) => v.map((x) => x / Math.hypot(...v));
    const n = 2000;
    const vecs = Array.from({ length: n }, () => unit(Array.from({ length: 24 }, r)));
    for (let k = 0; k < 40; k++) vecs[n - 1 - k] = unit(vecs[k]!.map((x) => x + r() * 0.05));
    const got = await pairsAtLeast(vecs, 0.9);
    const want: string[] = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) if (vecs[i]!.reduce((s, x, q) => s + x * vecs[j]![q]!, 0) >= 0.9) want.push(`${i}-${j}`);
    expect(got.map((p) => `${p.i}-${p.j}`)).toEqual(want);
  });
});
