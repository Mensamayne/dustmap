/**
 * Ranking: diverse kinds at one place beat many findings of a single category.
 */
import { describe, expect, it } from "vitest";
import type { FindingType } from "@dustmap/contract";
import { scorePlaces } from "./score.js";
import { DEFAULT_RANKING_WEIGHTS } from "./weights.js";

function finding(
  partial: Pick<FindingType, "fingerprint" | "kind" | "category"> & {
    path: string;
    confidence?: FindingType["confidence"];
    symbol?: string;
  },
): FindingType {
  return {
    fingerprint: partial.fingerprint,
    kind: partial.kind,
    category: partial.category,
    locations: [{ path: partial.path, ...(partial.symbol ? { symbol: partial.symbol } : {}) }],
    evidence: [],
    confidence: partial.confidence ?? "high",
    suggestedAction: "review",
    verifyHint: "Review.",
    source: "test",
  };
}

describe("scorePlaces", () => {
  it("ranks mixed hotspot+cluster+cycle above five same-category findings", () => {
    const diversePath = "src/hot.ts";
    const monoPath = "src/mono.ts";
    const findings: FindingType[] = [
      finding({
        fingerprint: "aaaaaaaaaaaaaaaa",
        kind: "hotspot",
        category: "refactor-signal",
        path: diversePath,
      }),
      finding({
        fingerprint: "bbbbbbbbbbbbbbbb",
        kind: "clone-cluster",
        category: "duplicate",
        path: diversePath,
      }),
      finding({
        fingerprint: "cccccccccccccccc",
        kind: "cycle",
        category: "structure",
        path: diversePath,
      }),
      ...[0, 1, 2, 3, 4].map((i) =>
        finding({
          fingerprint: `ddddddddddddddd${i}`,
          kind: "unused-export",
          category: "dead-code",
          path: monoPath,
          symbol: `sym${i}`,
        }),
      ),
    ];

    const ranked = scorePlaces(findings, DEFAULT_RANKING_WEIGHTS);
    expect(ranked[0]?.path).toBe(diversePath);
    expect(ranked[0]!.kinds.length).toBe(3);
    // Five separate places on mono (path#symbol) — none should outrank diverse file.
    expect(ranked.find((p) => p.path === diversePath)!.score).toBeGreaterThan(
      Math.max(...ranked.filter((p) => p.path.startsWith(monoPath)).map((p) => p.score)),
    );
  });
});
