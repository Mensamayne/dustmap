/**
 * `dustmap list` — browse findings with the same filter, sort and paging as MCP `dustmap_list`.
 */
import { listFindings, type ListFindingsPage } from "@dustmap/core";
import type { ListArgs } from "./args.js";
import { loadReportOrThrow, reportFlag, resolveCliOutputDir } from "./report-io.js";

export type CmdResult = { exitCode: 0 | 2; stdout: string; stderr: string };

export function runListCommand(args: ListArgs, cwd = process.cwd()): CmdResult {
  const outDir = resolveCliOutputDir(cwd, args.out);
  let page: ListFindingsPage;
  try {
    page = listFindings(loadReportOrThrow(outDir, args.report), {
      ...(args.category !== undefined ? { category: args.category } : {}),
      ...(args.minConfidence !== undefined ? { minConfidence: args.minConfidence } : {}),
      ...(args.path !== undefined ? { pathPrefix: args.path } : {}),
      ...(args.offset !== undefined ? { offset: args.offset } : {}),
      ...(args.limit !== undefined ? { limit: args.limit } : {}),
    });
  } catch (err) {
    return { exitCode: 2, stdout: "", stderr: `${err instanceof Error ? err.message : String(err)}\n` };
  }

  const items = page.items.map((f) => ({
    fingerprint: f.fingerprint,
    kind: f.kind,
    category: f.category,
    confidence: f.confidence,
    path: f.locations[0]?.path,
    symbol: f.locations[0]?.symbol,
    suggestedAction: f.suggestedAction,
  }));

  if (args.json) {
    const payload = { total: page.total, offset: page.offset, limit: page.limit, hasMore: page.hasMore, items };
    return { exitCode: 0, stdout: `${JSON.stringify(payload, null, 2)}\n`, stderr: "" };
  }

  const shown = items.length ? `${page.offset + 1}–${page.offset + items.length}` : "0";
  const lines = [`Findings ${shown} of ${page.total}`];
  for (const i of items) {
    const sym = i.symbol ? `#${i.symbol}` : "";
    lines.push(`  ${i.fingerprint}  ${i.confidence.padEnd(6)} ${i.kind}  ${i.path ?? "?"}${sym}`);
  }
  const first = items[0];
  if (page.hasMore) {
    lines.push(`next: dustmap list${reportFlag(args.report)} --offset ${page.offset + page.limit} --limit ${page.limit} --out ${outDir} (albo dustmap show <fingerprint>)`);
  } else if (first) {
    lines.push(`next: dustmap show ${first.fingerprint}${reportFlag(args.report)} --out ${outDir}`);
  } else {
    lines.push(`next: dustmap summary${reportFlag(args.report)} --out ${outDir}`);
  }
  return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" };
}
