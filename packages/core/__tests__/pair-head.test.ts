import { describe, expect, it } from "vitest";
import {
  cosinePairBaseline,
  mapGoldLabelToPairClass,
  pairClassIndex,
  pairFeatures,
  PAIR_HEAD_CLASSES,
} from "../src/semantic/pair-head.js";
import { clusterSemanticPairs, type SemanticFunctionRef } from "../src/semantic/cluster.js";

describe("pair-head contract", () => {
  it("maps gold labels onto three report classes", () => {
    expect(mapGoldLabelToPairClass("same")).toBe("same");
    expect(mapGoldLabelToPairClass("pattern")).toBe("pattern");
    expect(mapGoldLabelToPairClass("different")).toBe("other");
    expect(mapGoldLabelToPairClass("contains")).toBe("other");
    expect(mapGoldLabelToPairClass("concept")).toBe("other");
  });

  it("builds 4*dim features matching the Python recipe", () => {
    const a = [1, 0, -1];
    const b = [0.5, 0.5, 0];
    const f = pairFeatures(a, b);
    expect(f.length).toBe(12);
    expect([...f.slice(0, 3)]).toEqual(a);
    expect([...f.slice(3, 6)]).toEqual(b);
    expect([...f.slice(6, 9)]).toEqual([0.5, 0.5, 1]);
    expect(f[9]).toBeCloseTo(0.5);
    expect(Math.abs(f[10]!)).toBe(0);
    expect(Math.abs(f[11]!)).toBe(0);
  });

  it("orders class indices as same/pattern/other", () => {
    expect(PAIR_HEAD_CLASSES.map(pairClassIndex)).toEqual([0, 1, 2]);
  });

  it("cosine baseline separates floors", () => {
    expect(cosinePairBaseline(0.95, 0.9, 0.7)).toBe("same");
    expect(cosinePairBaseline(0.8, 0.9, 0.7)).toBe("pattern");
    expect(cosinePairBaseline(0.5, 0.9, 0.7)).toBe("other");
  });
});

describe("pair-head demotion in clusters", () => {
  const fn = (path: string, name: string, line: number): SemanticFunctionRef => ({
    path,
    name,
    startLine: line,
    endLine: line + 2,
    body: `function ${name}(){ return ${line}; }`,
  });

  it("lowers confidence when every link is pair-head pattern", () => {
    const a = fn("a.ts", "one", 1);
    const b = fn("b.ts", "two", 1);
    const cal = { bands: { high: 0.5, medium: 0.4, low: 0.2 } };
    const [plain] = clusterSemanticPairs([{ a, b, similarity: 0.95 }], 0.5, cal);
    const [pat] = clusterSemanticPairs([{ a, b, similarity: 0.95, pairClass: "pattern" }], 0.5, cal);
    expect(plain?.confidence).toBe("high");
    expect(pat?.confidence).toBe("medium");
  });
});
