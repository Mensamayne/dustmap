import { describe, expect, it } from "vitest";
import { clusterSemanticPairs, cosineSimilarity, pairsAboveThreshold } from "./cluster.js";
import type { SemanticFunctionRef } from "./cluster.js";

function fn(path: string, name: string, body: string): SemanticFunctionRef {
  return { path, name, startLine: 1, endLine: 10, body };
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
  });

  it("builds pairs from vectors above threshold", () => {
    const fns = [
      fn("a.ts", "a", "aaa"),
      fn("b.ts", "b", "bbb"),
      fn("c.ts", "c", "ccc"),
    ];
    const vectors = [
      [1, 0, 0],
      [0.99, 0.1, 0],
      [0, 1, 0],
    ];
    const pairs = pairsAboveThreshold(fns, vectors, 0.9);
    expect(pairs.length).toBe(1);
    expect(pairs[0]?.a.name).toBe("a");
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
  });
});
