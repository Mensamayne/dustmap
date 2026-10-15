/**
 * Literal copy-paste covered by clone-cluster must not also appear as semantic-cluster.
 */
import { describe, expect, it } from "vitest";
import { fingerprint, type FindingType } from "@dustmap/contract";
import { dedupeSemanticAgainstClones } from "../src/semantic/dedupe-vs-clones.js";

describe("semantic vs clone dedupe fixture policy", () => {
  it("removes semantic finding for an exact two-file copy already reported as clone-cluster", () => {
    const clone: FindingType = {
      fingerprint: fingerprint("clone-cluster", ["exact shared"], ["exactSharedBlock"]),
      kind: "clone-cluster",
      category: "duplicate",
      locations: [
        { path: "src/clone-a.ts", startLine: 1, endLine: 12 },
        { path: "src/clone-b.ts", startLine: 1, endLine: 12 },
      ],
      evidence: [{ label: "places", value: "2" }],
      confidence: "high",
      suggestedAction: "review",
      verifyHint: "extract",
      source: "jscpd",
    };
    const semantic: FindingType = {
      fingerprint: fingerprint("semantic-cluster", ["exact shared"], ["exactSharedBlock"]),
      kind: "semantic-cluster",
      category: "semantic-duplicate",
      locations: [
        { path: "src/clone-a.ts", startLine: 1, endLine: 12, symbol: "exactSharedBlock" },
        { path: "src/clone-b.ts", startLine: 1, endLine: 12, symbol: "exactSharedBlock" },
      ],
      evidence: [{ label: "functions", value: "2" }],
      confidence: "medium",
      suggestedAction: "review",
      verifyHint: "compare",
      source: "semantic",
    };
    const kept = dedupeSemanticAgainstClones([clone, semantic]);
    expect(kept).toHaveLength(1);
    expect(kept[0]?.kind).toBe("clone-cluster");
  });
});
