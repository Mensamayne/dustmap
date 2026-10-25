/**
 * `dustmap export --to markdown|sarif` — write human markdown or SARIF 2.1.0 (stdout or --file).
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { toSarif } from "@dustmap/contract";
import type { ExportArgs } from "../args.js";
import { loadReportOrThrow, resolveCliOutputDir } from "../report-io.js";
import { reportToMarkdown } from "./markdown.js";

export type CmdResult = { exitCode: 0 | 2; stdout: string; stderr: string };

export function runExportCommand(args: ExportArgs, cwd = process.cwd()): CmdResult {
  const outDir = resolveCliOutputDir(cwd, args.out);
  let report;
  try {
    report = loadReportOrThrow(outDir, args.report);
  } catch (err) {
    return { exitCode: 2, stdout: "", stderr: `${err instanceof Error ? err.message : String(err)}\n` };
  }

  const body =
    args.to === "markdown"
      ? reportToMarkdown(report)
      : `${JSON.stringify(toSarif(report), null, 2)}\n`;

  if (args.file) {
    const dest = path.resolve(cwd, args.file);
    writeFileSync(dest, body.endsWith("\n") ? body : `${body}\n`, "utf8");
    return {
      exitCode: 0,
      stdout: `Wrote ${args.to} to ${dest}\nnext: dustmap summary --out ${outDir}\n`,
      stderr: "",
    };
  }

  return { exitCode: 0, stdout: body.endsWith("\n") ? body : `${body}\n`, stderr: "" };
}
