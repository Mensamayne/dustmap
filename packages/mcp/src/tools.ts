/**
 * Dustmap MCP tool handlers — summary, list, show, decide, scan.
 * Pure data in / out; the server layer applies size limits and MCP content wrapping.
 */
import path from "node:path";
import {
  FindingCategory,
  type FindingCategoryType,
  type FindingType,
  type ReportType,
} from "@dustmap/contract";
import {
  builtinAdapters,
  loadConfig,
  resolveOutputDir,
  runScan,
  upsertDecision,
} from "@dustmap/core";
import { reportStaleWarning } from "./limits.js";
import {
  findFinding,
  gitHead,
  loadReportOrThrow,
  resolveMcpOutputDir,
} from "./report-io.js";

export type McpToolContext = {
  /** Working directory (scanned repo root). */
  cwd: string;
};

export type ToolSuccess = {
  ok: true;
  /** Payload before size-limit wrapping. */
  data: Record<string, unknown>;
  /** When set, attach stale warning relative to this report commit. */
  reportCommit?: string;
};

export type ToolFailure = {
  ok: false;
  error: string;
};

export type ToolResult = ToolSuccess | ToolFailure;

function withFreshness(
  data: Record<string, unknown>,
  report: ReportType,
  cwd: string,
): ToolSuccess {
  const head = gitHead(cwd);
  const staleWarning = reportStaleWarning(report.scan.commit, head);
  return {
    ok: true,
    reportCommit: report.scan.commit,
    data: {
      ...data,
      stale: staleWarning !== null,
      ...(staleWarning ? { staleWarning } : {}),
      head: head ?? null,
      reportCommit: report.scan.commit,
    },
  };
}

export type SummaryArgs = {
  out?: string;
};

export function dustmapSummary(ctx: McpToolContext, args: SummaryArgs = {}): ToolResult {
  const outDir = resolveMcpOutputDir(ctx.cwd, args.out);
  let report: ReportType;
  try {
    report = loadReportOrThrow(outDir);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const byCategory: Record<string, number> = {};
  for (const [cat, n] of Object.entries(report.summary.byCategory)) {
    if (n > 0) byCategory[cat] = n;
  }

  return withFreshness(
    {
      findingCount: report.findings.length,
      byCategory,
      topPlaces: report.summary.topPlaces.slice(0, 10).map((p) => ({
        path: p.path,
        score: p.score,
        signalCount: p.findingFingerprints.length,
        findingFingerprints: p.findingFingerprints.slice(0, 5),
      })),
      scannedAt: report.scan.startedAt,
      mode: report.scan.mode,
    },
    report,
    ctx.cwd,
  );
}

export type ListArgs = {
  out?: string;
  category?: string;
  pathPrefix?: string;
  offset?: number;
  limit?: number;
};

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

function filterFindings(report: ReportType, args: ListArgs): FindingType[] {
  let items = report.findings;
  if (args.category !== undefined) {
    const parsed = FindingCategory.safeParse(args.category);
    if (!parsed.success) {
      throw new Error(
        `Invalid category "${args.category}". Expected one of: ${FindingCategory.options.join(", ")}`,
      );
    }
    const cat: FindingCategoryType = parsed.data;
    items = items.filter((f) => f.category === cat);
  }
  if (args.pathPrefix !== undefined && args.pathPrefix.length > 0) {
    const prefix = args.pathPrefix.replace(/\\/g, "/").replace(/\/+$/, "");
    items = items.filter((f) =>
      f.locations.some((l) => l.path === prefix || l.path.startsWith(`${prefix}/`)),
    );
  }
  return items;
}

export function dustmapList(ctx: McpToolContext, args: ListArgs = {}): ToolResult {
  const outDir = resolveMcpOutputDir(ctx.cwd, args.out);
  let report: ReportType;
  try {
    report = loadReportOrThrow(outDir);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  let filtered: FindingType[];
  try {
    filtered = filterFindings(report, args);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const offset = Math.max(0, args.offset ?? 0);
  const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, args.limit ?? DEFAULT_LIST_LIMIT));
  const page = filtered.slice(offset, offset + limit);

  return withFreshness(
    {
      total: filtered.length,
      offset,
      limit,
      hasMore: offset + page.length < filtered.length,
      items: page.map((f) => ({
        fingerprint: f.fingerprint,
        kind: f.kind,
        category: f.category,
        confidence: f.confidence,
        path: f.locations[0]?.path,
        symbol: f.locations[0]?.symbol,
        suggestedAction: f.suggestedAction,
      })),
    },
    report,
    ctx.cwd,
  );
}

export type ShowArgs = {
  fingerprint: string;
  out?: string;
};

export function dustmapShow(ctx: McpToolContext, args: ShowArgs): ToolResult {
  const outDir = resolveMcpOutputDir(ctx.cwd, args.out);
  let report: ReportType;
  try {
    report = loadReportOrThrow(outDir);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const finding = findFinding(report, args.fingerprint);
  if (!finding) {
    return {
      ok: false,
      error: `No finding with fingerprint ${args.fingerprint} in ${outDir}`,
    };
  }

  return withFreshness(
    {
      finding: {
        fingerprint: finding.fingerprint,
        kind: finding.kind,
        category: finding.category,
        confidence: finding.confidence,
        source: finding.source,
        suggestedAction: finding.suggestedAction,
        verifyHint: finding.verifyHint,
        locations: finding.locations,
        evidence: finding.evidence,
        ...(finding.judgement ? { judgement: finding.judgement } : {}),
      },
    },
    report,
    ctx.cwd,
  );
}

export type DecideArgs = {
  fingerprint: string;
  verdict: "keep" | "fix" | "wontfix";
  reason: string;
  out?: string;
  by?: string;
};

export function dustmapDecide(ctx: McpToolContext, args: DecideArgs): ToolResult {
  const outDir = resolveMcpOutputDir(ctx.cwd, args.out);
  let report: ReportType;
  try {
    report = loadReportOrThrow(outDir);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const finding = findFinding(report, args.fingerprint);
  if (!finding) {
    return {
      ok: false,
      error: `No finding with fingerprint ${args.fingerprint} in ${outDir}`,
    };
  }

  if (args.reason.trim().length < 10) {
    return { ok: false, error: "Reason must be at least 10 characters" };
  }

  const file = upsertDecision(outDir, {
    fingerprint: args.fingerprint,
    verdict: args.verdict,
    reason: args.reason.trim(),
    by: args.by ?? "mcp",
    at: new Date().toISOString(),
  });

  const decision = file.decisions.find((d) => d.fingerprint === args.fingerprint);
  const muted = args.verdict === "keep" || args.verdict === "wontfix";

  return withFreshness(
    {
      recorded: true,
      decision,
      decisionsPath: path.join(outDir, "decisions.yml"),
      muted,
      note: muted
        ? "Next scan will hide this finding from the report until the fingerprint changes."
        : "Verdict is fix — finding stays visible until resolved.",
    },
    report,
    ctx.cwd,
  );
}

export type ScanArgs = {
  /** Repo to scan; defaults to context cwd. */
  repoPath?: string;
  out?: string;
  /** Default `diff`. */
  mode?: "full" | "diff";
  /** Base ref for diff mode; default `HEAD~1`. */
  baseRef?: string;
  config?: string;
};

export async function dustmapScan(
  ctx: McpToolContext,
  args: ScanArgs = {},
): Promise<ToolResult> {
  const repoRoot = path.resolve(ctx.cwd, args.repoPath ?? ".");
  const mode = args.mode ?? "diff";
  const baseRef = mode === "diff" ? (args.baseRef ?? "HEAD~1") : undefined;

  let configPath = args.config ? path.resolve(ctx.cwd, args.config) : undefined;
  try {
    loadConfig(repoRoot, configPath);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const loaded = loadConfig(repoRoot, configPath);
  const outputDir = args.out
    ? path.resolve(ctx.cwd, args.out)
    : resolveOutputDir(repoRoot, loaded.config.outputDir);

  try {
    const result = await runScan({
      repoRoot,
      mode,
      adapters: builtinAdapters(),
      outputDir,
      ...(baseRef ? { baseRef } : {}),
      ...(configPath ? { configPath } : {}),
    });

    const byCategory: Record<string, number> = {};
    for (const [cat, n] of Object.entries(result.report.summary.byCategory)) {
      if (n > 0) byCategory[cat] = n;
    }

    return {
      ok: true,
      reportCommit: result.report.scan.commit,
      data: {
        findingCount: result.report.findings.length,
        filesScanned: result.filesScanned.length,
        byCategory,
        topPlaces: result.report.summary.topPlaces.slice(0, 5).map((p) => ({
          path: p.path,
          score: p.score,
          signalCount: p.findingFingerprints.length,
        })),
        reportPath: result.reportPath,
        mode: result.report.scan.mode,
        stale: false,
        reportCommit: result.report.scan.commit,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Tool names registered on the MCP server (DUST-11). */
export const DUSTMAP_TOOL_NAMES = [
  "dustmap_summary",
  "dustmap_list",
  "dustmap_show",
  "dustmap_decide",
  "dustmap_scan",
] as const;

export type DustmapToolName = (typeof DUSTMAP_TOOL_NAMES)[number];
