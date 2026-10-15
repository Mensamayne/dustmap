import { describe, expect, it } from "vitest";
import { fingerprint, type FindingType } from "@dustmap/contract";
import { dedupeSemanticAgainstClones } from "./dedupe-vs-clones.js";

function cloneFinding(paths: string[]): FindingType {
  return {
    fingerprint: fingerprint("clone-cluster", paths, paths),
    kind: "clone-cluster",
    category: "duplicate",
    locations: paths.map((path) => ({ path, startLine: 1, endLine: 20 })),
    evidence: [],
    confidence: "high",
    suggestedAction: "review",
    verifyHint: "x",
    source: "jscpd",
  };
}

function semanticFinding(paths: string[]): FindingType {
  return {
    fingerprint: fingerprint("semantic-cluster", paths, paths),
    kind: "semantic-cluster",
    category: "semantic-duplicate",
    locations: paths.map((path) => ({ path, startLine: 2, endLine: 18, symbol: "f" })),
    evidence: [],
    confidence: "medium",
    suggestedAction: "review",
    verifyHint: "x",
    source: "semantic",
  };
}

describe("dedupeSemanticAgainstClones", () => {
  it("drops a semantic cluster fully covered by a clone-cluster", () => {
    const clone = cloneFinding(["src/clone-a.ts", "src/clone-b.ts"]);
    const semantic = semanticFinding(["src/clone-a.ts", "src/clone-b.ts"]);
    const other = semanticFinding(["src/sum-loop.ts", "src/sum-fold.ts"]);
    const out = dedupeSemanticAgainstClones([clone, semantic, other]);
    expect(out.some((f) => f.fingerprint === semantic.fingerprint)).toBe(false);
    expect(out.some((f) => f.fingerprint === other.fingerprint)).toBe(true);
    expect(out.some((f) => f.kind === "clone-cluster")).toBe(true);
  });
});
