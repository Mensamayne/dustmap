/**
 * Dustmap MCP tool handlers — summary, list, show, decide, scan, guide.
 * Pure data in / out; the server layer applies size limits and MCP content wrapping.
 * Every success payload includes `next` (1–3 suggested follow-ups, DUST-17).
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ReportType } from "@dustmap/contract";
import {
  builtinAdapters,
  listFindings,
  loadConfig,
  resolveOutputDir,
  runScan,
  upsertDecision,
  type ListFindingsPage,
} from "@dustmap/core";
import { reportFreshness, utf8Bytes } from "./limits.js";
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

export type NextHint = {
  tool: string;
  args?: Record<string, unknown>;
  reason: string;
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

/** Hard cap for dustmap_guide body (brief: ≤ 4 KiB). */
export const GUIDE_MAX_BYTES = 4 * 1024;

export type DustmapToolName =
  | "dustmap_summary"
  | "dustmap_list"
  | "dustmap_show"
  | "dustmap_decide"
  | "dustmap_scan"
  | "dustmap_guide";

function topFingerprint(data: Record<string, unknown>): string | undefined {
  const places = data.topPlaces;
  if (!Array.isArray(places) || places.length === 0) return undefined;
  const first = places[0] as { findingFingerprints?: unknown };
  const fps = first.findingFingerprints;
  if (!Array.isArray(fps) || typeof fps[0] !== "string") return undefined;
  return fps[0];
}

function firstListFingerprint(data: Record<string, unknown>): string | undefined {
  const items = data.items;
  if (!Array.isArray(items) || items.length === 0) return undefined;
  const fp = (items[0] as { fingerprint?: unknown }).fingerprint;
  return typeof fp === "string" ? fp : undefined;
}

/** 1–3 next tool calls an agent can follow without reading docs. */
export function suggestNext(
  tool: DustmapToolName,
  data: Record<string, unknown>,
): NextHint[] {
  if (
    (data.stale === true || data.stale === "unknown") &&
    tool !== "dustmap_scan" &&
    tool !== "dustmap_guide"
  ) {
    return [
      {
        tool: "dustmap_scan",
        args: { mode: "diff" },
        reason:
          data.stale === "unknown"
            ? "HEAD unavailable — scan in a repo with commits before decide/enqueue"
            : "Report is stale — refresh with a diff scan before decide/enqueue",
      },
    ];
  }

  switch (tool) {
    case "dustmap_guide":
      return [
        { tool: "dustmap_summary", reason: "See top places and report freshness" },
        {
          tool: "dustmap_scan",
          args: { mode: "diff" },
          reason: "If there is no report yet, or it is stale",
        },
      ];
    case "dustmap_scan":
      return [
        { tool: "dustmap_summary", reason: "Read counts and top places after the scan" },
      ];
    case "dustmap_summary": {
      const fp = topFingerprint(data);
      const next: NextHint[] = [
        { tool: "dustmap_list", reason: "Browse findings with filters / pagination" },
      ];
      if (fp) {
        next.push({
          tool: "dustmap_show",
          args: { fingerprint: fp },
          reason: "Inspect evidence for the top place",
        });
      }
      return next.slice(0, 3);
    }
    case "dustmap_list": {
      const fp = firstListFingerprint(data);
      if (!fp) {
        return [{ tool: "dustmap_summary", reason: "Return to overview" }];
      }
      return [
        {
          tool: "dustmap_show",
          args: { fingerprint: fp },
          reason: "Open full evidence + verifyHint for the first item",
        },
        {
          tool: "dustmap_list",
          args: {
            offset: typeof data.offset === "number" ? data.offset + (typeof data.limit === "number" ? data.limit : 20) : 20,
            limit: typeof data.limit === "number" ? data.limit : 20,
          },
          reason: "Next page if hasMore",
        },
      ].slice(0, 3);
    }
    case "dustmap_show": {
      const finding = data.finding as { fingerprint?: string } | undefined;
      const fp = finding?.fingerprint;
      if (!fp) {
        return [{ tool: "dustmap_summary", reason: "Back to overview" }];
      }
      return [
        {
          tool: "dustmap_decide",
          args: {
            fingerprint: fp,
            verdict: "keep",
            reason: "Explain why this finding is intentional (min 10 chars)",
          },
          reason: "After running verifyHint — record keep/wontfix/fix",
        },
        { tool: "dustmap_summary", reason: "Pick another place" },
      ];
    }
    case "dustmap_decide":
      return [
        {
          tool: "dustmap_scan",
          args: { mode: "diff" },
          reason: "Re-scan so muted findings drop out of the report",
        },
        { tool: "dustmap_summary", reason: "Confirm the new top places" },
      ];
    default:
      return [{ tool: "dustmap_guide", reason: "Re-read the agent loop" }];
  }
}

function withNext(tool: DustmapToolName, success: ToolSuccess): ToolSuccess {
  const next = suggestNext(tool, success.data);
  return {
    ...success,
    data: {
      ...success.data,
      next,
    },
  };
}

function withFreshness(
  tool: DustmapToolName,
  data: Record<string, unknown>,
  report: ReportType,
  cwd: string,
): ToolSuccess {
  const head = gitHead(cwd);
  const freshness = reportFreshness(report.scan.commit, head);
  return withNext(tool, {
    ok: true,
    reportCommit: report.scan.commit,
    data: {
      ...data,
      stale: freshness.stale,
      headAvailable: freshness.headAvailable,
      ...(freshness.warning ? { staleWarning: freshness.warning } : {}),
      head: head ?? null,
      reportCommit: report.scan.commit,
    },
  });
}

const EMBEDDED_GUIDE = `Dustmap agent loop (report-only; never edits scanned source).
1) dustmap_guide → 2) dustmap_summary (or dustmap_scan diff if missing/stale) →
3) dustmap_list / dustmap_show → 4) run verifyHint → 5) dustmap_decide or enqueue selected fingerprints.
Rules: no delete without verifyHint; no keep without reason; stale → scan diff first.
Tell humans places and effects, not fingerprint walls. Follow each reply's next[] field.`;

function loadGuideText(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const playbook = path.join(here, "..", "..", "cli", "agent", "PLAYBOOK.md");
  if (existsSync(playbook)) {
    return readFileSync(playbook, "utf8");
  }
  return EMBEDDED_GUIDE;
}

function truncateGuide(text: string, maxBytes: number): { guide: string; truncated: boolean } {
  if (utf8Bytes(text) <= maxBytes) {
    return { guide: text, truncated: false };
  }
  const marker = "\n…[guide truncated at 4 KiB — follow next[] or read PLAYBOOK.md]";
  const budget = Math.max(0, maxBytes - utf8Bytes(marker));
  const sliced = Buffer.from(text, "utf8").subarray(0, budget).toString("utf8");
  return { guide: `${sliced}${marker}`, truncated: true };
}

export function dustmapGuide(_ctx: McpToolContext = { cwd: process.cwd() }): ToolResult {
  const { guide, truncated } = truncateGuide(loadGuideText(), GUIDE_MAX_BYTES);
  return withNext("dustmap_guide", {
    ok: true,
    data: {
      guide,
      truncated,
      bytes: utf8Bytes(guide),
    },
  });
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
    "dustmap_summary",
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
  /** Minimum confidence floor: low | medium | high (inclusive). */
  minConfidence?: string;
  pathPrefix?: string;
  offset?: number;
  limit?: number;
};

export function dustmapList(ctx: McpToolContext, args: ListArgs = {}): ToolResult {
  const outDir = resolveMcpOutputDir(ctx.cwd, args.out);
  let report: ReportType;
  try {
    report = loadReportOrThrow(outDir);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  let page: ListFindingsPage;
  try {
    page = listFindings(report, args);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return withFreshness(
    "dustmap_list",
    {
      total: page.total,
      offset: page.offset,
      limit: page.limit,
      hasMore: page.hasMore,
      items: page.items.map((f) => ({
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
    "dustmap_show",
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
    "dustmap_decide",
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

  const configPath = args.config ? path.resolve(ctx.cwd, args.config) : undefined;
  let loaded: ReturnType<typeof loadConfig>;
  try {
    loaded = loadConfig(repoRoot, configPath);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

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

    // Same freshness contract as the read tools (BUG-04): a repo without HEAD is never "fresh".
    return withFreshness(
      "dustmap_scan",
      {
        findingCount: result.report.findings.length,
        filesScanned: result.filesScanned.length,
        byCategory,
        topPlaces: result.report.summary.topPlaces.slice(0, 5).map((p) => ({
          path: p.path,
          score: p.score,
          signalCount: p.findingFingerprints.length,
          findingFingerprints: p.findingFingerprints.slice(0, 3),
        })),
        reportPath: result.reportPath,
        mode: result.report.scan.mode,
      },
      result.report,
      repoRoot,
    );
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Tool names registered on the MCP server (DUST-11 + guide from DUST-17). */
export const DUSTMAP_TOOL_NAMES = [
  "dustmap_summary",
  "dustmap_list",
  "dustmap_show",
  "dustmap_decide",
  "dustmap_scan",
  "dustmap_guide",
] as const;
