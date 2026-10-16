/**
 * Ranking tunables — category × confidence weights and diversity bonus for mixed signal kinds.
 * Overridable via config.ranking.
 */
import type { ConfidenceType, FindingCategoryType } from "@dustmap/contract";
import type { RankingConfig } from "../config/schema.js";

export type RankingWeights = {
  topN: number;
  categoryWeights: Record<FindingCategoryType, number>;
  confidenceWeights: Record<ConfidenceType, number>;
  /** Extra points per distinct finding kind beyond the first at a place. */
  diversityBonus: number;
};

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  topN: 10,
  categoryWeights: {
    "dead-code": 1,
    duplicate: 1.2,
    "semantic-duplicate": 1.1,
    "refactor-signal": 1.3,
    structure: 1.4,
  },
  confidenceWeights: {
    low: 0.5,
    medium: 1,
    high: 1.5,
  },
  diversityBonus: 3,
};

/** Map Zod ranking config (or defaults) into the scorer's weight bag. */
export function rankingWeightsFromConfig(ranking: RankingConfig): RankingWeights {
  return {
    topN: ranking.topN,
    diversityBonus: ranking.diversityBonus,
    categoryWeights: { ...ranking.categoryWeights },
    confidenceWeights: { ...ranking.confidenceWeights },
  };
}

function num(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : fallback;
}

export function parseRankingWeights(raw: Record<string, unknown> | undefined): RankingWeights {
  const src = raw ?? {};
  const catRaw = (src.categoryWeights ?? {}) as Record<string, unknown>;
  const confRaw = (src.confidenceWeights ?? {}) as Record<string, unknown>;
  const base = DEFAULT_RANKING_WEIGHTS;
  return {
    topN: Math.max(1, Math.floor(num(src.topN, base.topN))),
    categoryWeights: {
      "dead-code": num(catRaw["dead-code"], base.categoryWeights["dead-code"]),
      duplicate: num(catRaw.duplicate, base.categoryWeights.duplicate),
      "semantic-duplicate": num(
        catRaw["semantic-duplicate"],
        base.categoryWeights["semantic-duplicate"],
      ),
      "refactor-signal": num(catRaw["refactor-signal"], base.categoryWeights["refactor-signal"]),
      structure: num(catRaw.structure, base.categoryWeights.structure),
    },
    confidenceWeights: {
      low: num(confRaw.low, base.confidenceWeights.low),
      medium: num(confRaw.medium, base.confidenceWeights.medium),
      high: num(confRaw.high, base.confidenceWeights.high),
    },
    diversityBonus: num(src.diversityBonus, base.diversityBonus),
  };
}
