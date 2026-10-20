/**
 * `dustmap decide <fingerprint> keep|fix|wontfix --reason …` — write decisions.yml under outputDir.
 */
import { upsertDecision } from "@dustmap/core";
import type { DecideArgs } from "./args.js";
import { findFinding, loadReportOrThrow, resolveCliOutputDir } from "./report-io.js";

export type CmdResult = { exitCode: 0 | 2; stdout: string; stderr: string };

export function runDecideCommand(args: DecideArgs, cwd = process.cwd()): CmdResult {
  const outDir = resolveCliOutputDir(cwd, args.out);
  let report;
  try {
    report = loadReportOrThrow(outDir, args.report);
  } catch (err) {
    return { exitCode: 2, stdout: "", stderr: `${err instanceof Error ? err.message : String(err)}\n` };
  }

  const finding = findFinding(report, args.fingerprint);
  if (!finding) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `No finding with fingerprint ${args.fingerprint} in ${outDir} (${args.report} report)\n`,
    };
  }

  if (args.reason.trim().length < 10) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "Reason must be at least 10 characters (--reason)\n",
    };
  }

  const file = upsertDecision(outDir, {
    fingerprint: args.fingerprint,
    verdict: args.verdict,
    reason: args.reason.trim(),
    by: args.by ?? "cli",
    at: new Date().toISOString(),
  });

  if (args.json) {
    return {
      exitCode: 0,
      stdout: `${JSON.stringify({ decision: file.decisions.find((d) => d.fingerprint === args.fingerprint), outDir }, null, 2)}\n`,
      stderr: "",
    };
  }

  const muted = args.verdict === "keep" || args.verdict === "wontfix";
  const lines = [
    `Recorded ${args.verdict} for ${args.fingerprint}`,
    muted
      ? "Next scan will hide this finding from the report (until the code fingerprint changes)."
      : "Verdict is fix — finding stays visible until resolved.",
    `dalej: dustmap scan --out ${outDir} (a full scan drops muted findings from the map)`,
  ];
  return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" };
}
