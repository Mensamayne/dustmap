import { describe, expect, it } from "vitest";
import { clusterSemanticPairs, cosineSimilarity, pairsAboveThreshold } from "./cluster.js";
import type { SemanticFunctionRef } from "./cluster.js";
import { pairsAtLeast } from "./similarity.js";

function fn(path: string, name: string, body: string, startLine = 1): SemanticFunctionRef {
  return { path, name, startLine, endLine: startLine + 9, body };
}

describe("semantic cluster", () => {
  it("merges A≈B and B≈C into one three-function cluster when A and C are close too", () => {
    const a = fn("src/a.ts", "a", "function a(){ return 1 }");
    const b = fn("src/b.ts", "b", "function b(){ return 2 }");
    const c = fn("src/c.ts", "c", "function c(){ return 3 }");
    const findings = clusterSemanticPairs(
      [
        { a, b, similarity: 0.91 },
        { a: b, b: c, similarity: 0.88 },
      ],
      0.82,
      null,
      () => 0.8,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.kind).toBe("semantic-cluster");
    expect(findings[0]?.locations).toHaveLength(3);
    expect(findings[0]?.confidence).toBe("medium");
    expect(findings[0]?.evidence.find((e) => e.label === "shape")?.value).toBe("copies: 3 functions");
  });

  it("the pair judge's reading is evidence: its probability range, or that no judge read the pairs", () => {
    const a = fn("src/a.ts", "a", "function a(){ return 1 }");
    const b = fn("src/b.ts", "b", "function b(){ return 2 }");
    const judged = clusterSemanticPairs([{ a, b, similarity: 0.91, judge: 0.87 }], 0.82, null, null, { id: "j@1", threshold: 0.5, minBand: "medium" as const });
    expect(judged[0]?.evidence.find((e) => e.label === "judge")?.value).toBe("j@1: 1 of 1 linked pairs read as the same job (probability 0.87–0.87, threshold 0.5)");
    expect(judged[0]?.confidence).toBe("medium");
    // Rejected: demoted to low and said so, never dropped (type-4 duplicates are the judge's weak spot).
    const rejected = clusterSemanticPairs([{ a, b, similarity: 0.91, judge: 0.12 }], 0.82, null, null, { id: "j@1", threshold: 0.5, minBand: "medium" as const });
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.confidence).toBe("low");
    expect(rejected[0]?.evidence.find((e) => e.label === "judge")?.value).toContain("0 of 1 linked pairs read as the same job");
    expect(rejected[0]?.evidence.find((e) => e.label === "judge")?.value).toContain("low confidence, check by hand");
    const missing = clusterSemanticPairs([{ a, b, similarity: 0.91 }], 0.82, null, null, { missing: 'pair judge "j" is not installed' });
    expect(missing[0]?.evidence.find((e) => e.label === "judge")?.value).toBe('not judged — pair judge "j" is not installed; similarity only');
    expect(clusterSemanticPairs([{ a, b, similarity: 0.91 }], 0.82)[0]?.evidence.some((e) => e.label === "judge")).toBe(false);
  });

  it("with minBand high, a judged group below the high similarity band stays low and says why", () => {
    const a = fn("src/a.ts", "a", "function a(){ return 1 }");
    const b = fn("src/b.ts", "b", "function b(){ return 2 }");
    const cal = { bands: { high: 0.9, medium: 0.8, low: 0.5 } };
    const note = { id: "j@1", threshold: 0.5, minBand: "high" as const };
    const below = clusterSemanticPairs([{ a, b, similarity: 0.85, judge: 0.95 }], 0.8, cal, null, note);
    expect(below[0]?.confidence).toBe("low");
    expect(below[0]?.evidence.find((e) => e.label === "judge")?.value).toContain("similarity below the high band");
    const above = clusterSemanticPairs([{ a, b, similarity: 0.95, judge: 0.95 }], 0.8, cal, null, note);
    expect(above[0]?.confidence).toBe("high");
  });

  it("does not link a nested helper to its outer function in the same file", () => {
    const outer = fn("src/x.ts", "outer", "function outer(){ function inner(){} }", 1);
    outer.endLine = 20;
    const inner = fn("src/x.ts", "inner", "function inner(){}", 5);
    inner.endLine = 10;
    const findings = clusterSemanticPairs([{ a: outer, b: inner, similarity: 0.95 }], 0.82);
    expect(findings).toHaveLength(0);
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
    // Parallel twins drop one confidence band (high→medium with cal; here uncalibrated max 0.90 → medium, then → low).
    expect(parallel.confidence).toBe("low");
    expect(parallel.evidence.find((e) => e.label === "shared-pattern")?.value).toMatch(/parallel file twins/);
    expect(findings.find((f) => f.locations.length === 2)?.evidence.find((e) => e.label === "shape")?.value).toBe("copies: 2 functions");
  });

  it("one weak link does not chain two families into one group (average linkage)", () => {
    const fam = (tag: string) => [0, 1, 2].map((k) => fn(`src/${tag}${k}.ts`, `${tag}${k}`, `function ${tag}${k}(){}`));
    const [a, b] = [fam("loop"), fam("sum")];
    const strong = (xs: SemanticFunctionRef[]) => [
      { a: xs[0]!, b: xs[1]!, similarity: 0.94 },
      { a: xs[1]!, b: xs[2]!, similarity: 0.93 },
      { a: xs[0]!, b: xs[2]!, similarity: 0.92 },
    ];
    const findings = clusterSemanticPairs([...strong(a), ...strong(b), { a: a[0]!, b: b[0]!, similarity: 0.45 }], 0.4);
    expect(findings.map((f) => f.locations.length).sort()).toEqual([3, 3]);
  });

  it("each place carries its own function; editing any member's code changes the fingerprint (BUG-07)", () => {
    const a = fn("src/total-of.ts", "totalOf", "function totalOf(v){ let s=0; for (const x of v) s+=x; return s }");
    const b = fn("src/fold-sum.ts", "foldSum", "function foldSum(l){ let r=0; for (const i of l) r+=i; return r }");
    const [before] = clusterSemanticPairs([{ a, b, similarity: 0.9 }], 0.82);
    expect(before!.locations.map((l) => [l.path, l.symbol])).toEqual([["src/fold-sum.ts", "foldSum"], ["src/total-of.ts", "totalOf"]]);
    const edited = { ...b, body: b.body.replace("r+=i", "r+=i*1") };
    const [after] = clusterSemanticPairs([{ a, b: edited, similarity: 0.9 }], 0.82);
    expect(after!.fingerprint).not.toBe(before!.fingerprint);
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
