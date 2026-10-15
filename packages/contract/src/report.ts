/**
 * Report v1 — the single document written under outputDir and read by CLI, MCP, SARIF, sinks.
 */
import { z } from "zod";
import { Finding, FindingCategory } from "./finding.js";
import { RepoRelativePath } from "./paths.js";

export const ScanMode = z.enum(["full", "diff"]);
export type ScanMode = z.infer<typeof ScanMode>;

export const ScanTool = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    /** Set when the adapter threw; other adapters still contribute findings. */
    error: z.string().min(1).optional(),
  })
  .strict();
export type ScanTool = z.infer<typeof ScanTool>;

export const CacheStats = z
  .object({
    hits: z.number().int().nonnegative(),
    misses: z.number().int().nonnegative(),
  })
  .strict();
export type CacheStats = z.infer<typeof CacheStats>;

export const ScanMeta = z
  .object({
    mode: ScanMode,
    commit: z.string().min(1),
    baseRef: z.string().min(1).optional(),
    startedAt: z.string().datetime({ offset: true }),
    tools: z.array(ScanTool).min(1),
    cache: CacheStats.optional(),
  })
  .strict();
export type ScanMeta = z.infer<typeof ScanMeta>;

export const CategoryCounts = z.record(FindingCategory, z.number().int().nonnegative());
export type CategoryCounts = z.infer<typeof CategoryCounts>;

export const TopPlace = z
  .object({
    path: RepoRelativePath,
    score: z.number().nonnegative(),
    findingFingerprints: z.array(z.string().regex(/^[a-f0-9]{16}$/)).min(1),
  })
  .strict();
export type TopPlace = z.infer<typeof TopPlace>;

export const ReportSummary = z
  .object({
    byCategory: CategoryCounts,
    topPlaces: z.array(TopPlace),
  })
  .strict();
export type ReportSummary = z.infer<typeof ReportSummary>;

export const REPORT_SCHEMA_ID = "dustmap.report/v1" as const;

export const Report = z
  .object({
    schema: z.literal(REPORT_SCHEMA_ID),
    scan: ScanMeta,
    summary: ReportSummary,
    findings: z.array(Finding),
  })
  .strict();
export type Report = z.infer<typeof Report>;
