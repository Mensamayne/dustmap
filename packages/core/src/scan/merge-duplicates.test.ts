import { describe, expect, it } from "vitest";
import { fingerprint, type FindingType } from "@dustmap/contract";
import { mergeDuplicateLayers, samePlace } from "./merge-duplicates.js";

type Loc = { path: string; startLine: number; endLine: number; symbol?: string };

function finding(kind: FindingType["kind"], locations: Loc[], confidence: FindingType["confidence"], evidence: FindingType["evidence"] = []): FindingType {
  return {
    fingerprint: fingerprint(kind, locations.map((l) => `${l.path}:${l.startLine}`), [kind]),
    kind,
    category: kind === "semantic-cluster" ? "semantic-duplicate" : kind === "unused-file" ? "dead-code" : "duplicate",
    locations,
    evidence,
    confidence,
    suggestedAction: "review",
    verifyHint: "x",
    source: kind,
  };
}

const ab = (start: number, end: number): Loc[] => [
  { path: "src/a.ts", startLine: start, endLine: end },
  { path: "src/b.ts", startLine: start, endLine: end },
];

describe("one finding per duplicated concept (DUP-06)", () => {
  it("the same place: same file, overlap at least half, sizes within a factor of two", () => {
    expect(samePlace({ path: "a", startLine: 1, endLine: 12 }, { path: "a", startLine: 2, endLine: 12 })).toBe(true);
    expect(samePlace({ path: "a", startLine: 1, endLine: 300 }, { path: "a", startLine: 10, endLine: 20 })).toBe(false);
    expect(samePlace({ path: "a", startLine: 1, endLine: 12 }, { path: "b", startLine: 1, endLine: 12 })).toBe(false);
  });

  it("an exact two-file copy found by tokens, L1 and meaning is one finding led by L1, with every layer named", () => {
    const jscpd = finding("clone-cluster", ab(1, 12), "high");
    const l1 = finding("exact-clone", ab(1, 12), "high", [{ label: "sketch-blocked", value: "same code" }]);
    const l3 = finding("semantic-cluster", ab(2, 12), "medium", [{ label: "judge", value: "j: 1 of 1 linked pairs read as the same job" }]);
    const out = mergeDuplicateLayers([jscpd, l3, l1]);
    expect(out).toHaveLength(1);
    expect(out[0]!.fingerprint).toBe(l1.fingerprint);
    expect(out[0]!.locations).toHaveLength(2);
    const ev = (label: string) => out[0]!.evidence.find((e) => e.label === label)?.value;
    expect(ev("layer")).toBe("L1 normalized copy");
    expect(ev("found-by")).toContain("3 layers agree");
    expect(ev("judge")).toContain("same job");
  });

  it("the strongest confidence leads; a set inside a larger set is another group, not merged", () => {
    const l2 = finding("near-clone", ab(1, 20), "medium");
    const jscpd = finding("clone-cluster", ab(1, 20), "high");
    const out = mergeDuplicateLayers([l2, jscpd]);
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe("clone-cluster");
    // Three identical loops (L1) inside seven loops alike in meaning (L3): two true statements, two findings.
    const l1 = finding("exact-clone", ab(1, 20), "high");
    const l3 = finding("semantic-cluster", [...ab(1, 20), { path: "src/c.ts", startLine: 5, endLine: 24 }], "low");
    const both = mergeDuplicateLayers([l1, l3]);
    expect(both).toHaveLength(2);
    expect(both.find((f) => f.kind === "semantic-cluster")!.confidence).toBe("low");
  });

  it("functions copied inside a copied block are parts of it, not separate reports, and never merged with each other", () => {
    const block = finding("clone-cluster", ab(1, 300), "medium");
    const f1 = finding("exact-clone", ab(10, 20), "high", [{ label: "sketch", value: "f1 sketch" }]);
    const f2 = finding("exact-clone", ab(100, 130), "high");
    const out = mergeDuplicateLayers([block, f1, f2]);
    expect(out).toHaveLength(1);
    expect(out[0]!.fingerprint).toBe(block.fingerprint);
    // A part says how certain the part is, not the whole.
    expect(out[0]!.confidence).toBe("medium");
    expect(out[0]!.evidence.find((e) => e.label === "parts")?.value).toMatch(/^2 smaller findings inside these places/);
    // A part's sketch describes the part, not the whole block.
    expect(out[0]!.evidence.some((e) => e.label === "sketch")).toBe(false);
  });

  it("two places of a part inside one place of the other is not the same copy relation", () => {
    const one = finding("near-clone", [{ path: "src/a.ts", startLine: 1, endLine: 100 }, { path: "src/b.ts", startLine: 1, endLine: 100 }], "medium");
    const inner = finding("exact-clone", [{ path: "src/a.ts", startLine: 10, endLine: 20 }, { path: "src/a.ts", startLine: 40, endLine: 50 }], "high");
    expect(mergeDuplicateLayers([one, inner])).toHaveLength(2);
  });

  it("a token copy no other layer confirms is capped (default medium) and says why; confirmed it keeps high", () => {
    const alone = mergeDuplicateLayers([finding("clone-cluster", ab(1, 12), "high")]);
    expect(alone[0]!.confidence).toBe("medium");
    expect(alone[0]!.evidence.find((e) => e.label === "token-only")?.value).toContain("high capped at medium");
    expect(mergeDuplicateLayers([finding("clone-cluster", ab(1, 12), "high")], { tokenCopyAloneMax: "high" })[0]!.confidence).toBe("high");
    const confirmed = mergeDuplicateLayers([finding("clone-cluster", ab(1, 12), "high"), finding("exact-clone", ab(1, 12), "high")]);
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]!.confidence).toBe("high");
  });

  it("other categories pass through untouched", () => {
    const dead = finding("unused-file", [{ path: "src/x.ts", startLine: 1, endLine: 1 }], "high");
    expect(mergeDuplicateLayers([dead])).toEqual([dead]);
  });
});
