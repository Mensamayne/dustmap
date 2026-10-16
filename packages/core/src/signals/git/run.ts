/**
 * Git-history signals adapter — hotspot, co-change, fix-density. Read-only git; log cached under
 * outputDir for cheap diff re-scans.
 */
import type { FindingType } from "@dustmap/contract";
import type { Adapter, AdapterContext } from "../../adapter.js";
import { resolveOutputDir } from "../../config/load.js";
import { isGitWorkTree } from "../../scan/git.js";
import { collectFileMetrics } from "../code/metrics.js";
import { loadGitLogCached } from "./diff-mode.js";
import { buildGitFindings, type FileComplexity } from "./signals.js";
import { parseGitSignalThresholds } from "./thresholds.js";

const ADAPTER_REV = "1";

/** Last cache stats (tests assert diff mode does not re-run git log). */
export const gitSignalsLastStats: { hit: boolean; ranGitLog: boolean } = {
  hit: false,
  ranGitLog: false,
};

async function complexityMap(
  ctx: AdapterContext,
  paths: Iterable<string>,
): Promise<Map<string, FileComplexity>> {
  const out = new Map<string, FileComplexity>();
  for (const p of paths) {
    if (ctx.roles.get(p) !== "source") continue;
    try {
      const text = await ctx.readFile(p);
      const m = collectFileMetrics(p, text);
      const maxCyclomatic = m.functions.reduce((max, f) => Math.max(max, f.cyclomatic), 1);
      out.set(p, { maxCyclomatic });
    } catch {
      out.set(p, { maxCyclomatic: 1 });
    }
  }
  return out;
}

export async function runGitSignals(ctx: AdapterContext): Promise<FindingType[]> {
  if (!isGitWorkTree(ctx.repoRoot)) return [];

  const rawOpts = ctx.config.adapters["git-signals"]?.options as
    | Record<string, unknown>
    | undefined;
  const thresholds = parseGitSignalThresholds(rawOpts);
  const outputDir = resolveOutputDir(ctx.repoRoot, ctx.config.outputDir);
  const { log, stats } = loadGitLogCached(ctx.repoRoot, outputDir, thresholds);
  gitSignalsLastStats.hit = stats.hit;
  gitSignalsLastStats.ranGitLog = stats.ranGitLog;

  if (log.commits.length === 0) return [];

  const focus =
    ctx.mode === "diff" ? new Set(ctx.filesWithRole("source")) : undefined;

  // Complexity only for files that appear in the log (and focus set when diffing).
  const pathsNeedingCx = new Set<string>();
  for (const c of log.commits) {
    for (const f of c.files) {
      if (!focus || focus.has(f)) pathsNeedingCx.add(f);
    }
  }
  const complexityByFile = await complexityMap(ctx, pathsNeedingCx);
  return buildGitFindings(log, thresholds, complexityByFile, focus);
}

export function gitSignalsAdapter(): Adapter {
  return {
    name: "git-signals",
    version: () => `git-signals+dm${ADAPTER_REV}`,
    run: runGitSignals,
  };
}
