/**
 * `dustmap show <fingerprint>` — one finding with evidence and locations.
 */
import type { ShowArgs } from "./args.js";
import { findFinding, loadReportOrThrow, reportFlag, resolveCliOutputDir } from "./report-io.js";

export type CmdResult = { exitCode: 0 | 2; stdout: string; stderr: string };

export function runShowCommand(args: ShowArgs, cwd = process.cwd()): CmdResult {
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

  if (args.json) {
    return { exitCode: 0, stdout: `${JSON.stringify(finding, null, 2)}\n`, stderr: "" };
  }

  const lines = [
    `${finding.kind} · ${finding.category} · ${finding.confidence}`,
    `fingerprint: ${finding.fingerprint}`,
    `source: ${finding.source}`,
    `action: ${finding.suggestedAction}`,
    `hint: ${finding.verifyHint}`,
    "locations:",
    ...finding.locations.map((l) => {
      const range =
        l.startLine !== undefined
          ? `:${l.startLine}${l.endLine !== undefined ? `-${l.endLine}` : ""}`
          : "";
      const sym = l.symbol ? ` (${l.symbol})` : "";
      return `  - ${l.path}${range}${sym}`;
    }),
    "evidence:",
    ...(finding.evidence.length
      ? finding.evidence.map((e) => `  - ${e.label}: ${e.value}`)
      : ["  - (none)"]),
  ];
  if (finding.judgement) {
    lines.push(
      `judgement: ${finding.judgement.verdict} (${finding.judgement.model})`,
      `  ${finding.judgement.reason}`,
    );
  }
  lines.push(`next: dustmap decide ${finding.fingerprint} keep --reason "…"${reportFlag(args.report)} --out ${outDir}`);
  return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" };
}
