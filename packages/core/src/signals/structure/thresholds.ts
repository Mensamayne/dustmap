/**
 * Tunables for structure signals. Overridable via adapters.depcruise.options.
 */

export type StructureThresholds = {
  /**
   * Report modules in the top this percent of fan-in (and separately fan-out) among modules
   * that have at least one edge. Relative to the scanned set, not a fixed count.
   */
  hubTopPercent: number;
  /** Absolute floor so tiny repos do not flag every file as a hub. */
  hubMinDegree: number;
};

export const DEFAULT_STRUCTURE_THRESHOLDS: StructureThresholds = {
  hubTopPercent: 5,
  hubMinDegree: 5,
};

function num(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function parseStructureThresholds(
  raw: Record<string, unknown> | undefined,
): StructureThresholds {
  const src = raw ?? {};
  return {
    hubTopPercent: num(src.hubTopPercent, DEFAULT_STRUCTURE_THRESHOLDS.hubTopPercent),
    hubMinDegree: num(src.hubMinDegree, DEFAULT_STRUCTURE_THRESHOLDS.hubMinDegree),
  };
}

/** Cutoff for "top P%" of a sorted ascending degree list (inclusive). */
export function topPercentCutoff(sortedAsc: readonly number[], topPercent: number): number {
  if (sortedAsc.length === 0) return Number.POSITIVE_INFINITY;
  const pct = Math.min(100, Math.max(0.1, topPercent));
  const keep = Math.max(1, Math.ceil((sortedAsc.length * pct) / 100));
  const index = sortedAsc.length - keep;
  return sortedAsc[Math.max(0, index)] ?? Number.POSITIVE_INFINITY;
}
