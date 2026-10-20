/**
 * Browse findings of a report: filter by category / confidence floor / path prefix, sort highest
 * confidence first, then page. One implementation behind `dustmap_list` (MCP) and `dustmap list` (CLI).
 */
import {
  Confidence,
  FindingCategory,
  type ConfidenceType,
  type FindingType,
  type ReportType,
} from "@dustmap/contract";

export type ListFindingsOptions = {
  category?: string;
  /** Minimum confidence floor: low | medium | high (inclusive). */
  minConfidence?: string;
  pathPrefix?: string;
  offset?: number;
  limit?: number;
};

export type ListFindingsPage = {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  items: FindingType[];
};

export const DEFAULT_LIST_LIMIT = 20;
export const MAX_LIST_LIMIT = 50;

const CONFIDENCE_RANK: Record<ConfidenceType, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/** Throws with the list of allowed values when `category` or `minConfidence` is not in the contract. */
export function listFindings(report: ReportType, opts: ListFindingsOptions = {}): ListFindingsPage {
  let items = report.findings;
  if (opts.category !== undefined) {
    const parsed = FindingCategory.safeParse(opts.category);
    if (!parsed.success) {
      throw new Error(
        `Invalid category "${opts.category}". Expected one of: ${FindingCategory.options.join(", ")}`,
      );
    }
    items = items.filter((f) => f.category === parsed.data);
  }
  if (opts.minConfidence !== undefined) {
    const parsed = Confidence.safeParse(opts.minConfidence);
    if (!parsed.success) {
      throw new Error(
        `Invalid minConfidence "${opts.minConfidence}". Expected one of: ${Confidence.options.join(", ")}`,
      );
    }
    const floor = CONFIDENCE_RANK[parsed.data];
    items = items.filter((f) => CONFIDENCE_RANK[f.confidence] >= floor);
  }
  if (opts.pathPrefix !== undefined && opts.pathPrefix.length > 0) {
    const prefix = opts.pathPrefix.replace(/\\/g, "/").replace(/\/+$/, "");
    items = items.filter((f) =>
      f.locations.some((l) => l.path === prefix || l.path.startsWith(`${prefix}/`)),
    );
  }
  // Highest confidence first so "safest deletes" land on page 1 without scanning.
  const sorted = [...items].sort((a, b) => {
    const byConf = CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence];
    if (byConf !== 0) return byConf;
    return a.fingerprint.localeCompare(b.fingerprint);
  });

  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIST_LIMIT));
  const page = sorted.slice(offset, offset + limit);
  return {
    total: sorted.length,
    offset,
    limit,
    hasMore: offset + page.length < sorted.length,
    items: page,
  };
}
