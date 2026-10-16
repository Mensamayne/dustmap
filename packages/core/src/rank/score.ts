/**
 * Place ranking — a place is a file, or file#symbol when the finding names a symbol.
 * Score = Σ (categoryWeight × confidenceWeight) + diversityBonus × (distinct kinds − 1).
 */
import type {
  FindingCategoryType,
  FindingType,
  TopPlaceType,
} from "@dustmap/contract";
import type { RankingWeights } from "./weights.js";

export type PlaceScore = TopPlaceType & {
  /** Distinct finding kinds that contributed (for tests / debug). */
  kinds: string[];
};

/** Stable place id used as TopPlace.path (file, or file#symbol). */
export function placeKey(path: string, symbol?: string): string {
  if (symbol && symbol.trim()) return `${path}#${symbol.trim()}`;
  return path;
}

function emptyByCategory(): Record<FindingCategoryType, number> {
  return {
    "dead-code": 0,
    duplicate: 0,
    "semantic-duplicate": 0,
    "refactor-signal": 0,
    structure: 0,
  };
}

/**
 * Score places from findings. Multi-location findings (e.g. cycles) contribute to each location.
 */
export function scorePlaces(
  findings: readonly FindingType[],
  weights: RankingWeights,
): PlaceScore[] {
  type Acc = {
    score: number;
    fps: Set<string>;
    kinds: Set<string>;
  };
  const places = new Map<string, Acc>();

  for (const f of findings) {
    const base =
      weights.categoryWeights[f.category] * weights.confidenceWeights[f.confidence];
    for (const loc of f.locations) {
      const key = placeKey(loc.path, loc.symbol);
      const cur = places.get(key) ?? { score: 0, fps: new Set(), kinds: new Set() };
      cur.score += base;
      cur.fps.add(f.fingerprint);
      cur.kinds.add(f.kind);
      places.set(key, cur);
    }
  }

  const scored: PlaceScore[] = [];
  for (const [path, acc] of places) {
    const diversity = Math.max(0, acc.kinds.size - 1) * weights.diversityBonus;
    scored.push({
      path,
      score: acc.score + diversity,
      findingFingerprints: [...acc.fps].sort(),
      kinds: [...acc.kinds].sort(),
    });
  }

  return scored.sort(
    (a, b) => b.score - a.score || a.path.localeCompare(b.path),
  );
}

export function summarizeFindings(
  findings: readonly FindingType[],
  weights: RankingWeights,
): {
  byCategory: Record<FindingCategoryType, number>;
  topPlaces: TopPlaceType[];
} {
  const byCategory = emptyByCategory();
  for (const f of findings) {
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  }
  const topPlaces = scorePlaces(findings, weights)
    .slice(0, weights.topN)
    .map(({ path, score, findingFingerprints }) => ({ path, score, findingFingerprints }));
  return { byCategory, topPlaces };
}
