/**
 * Which file under outputDir holds which report. A full scan owns `report.json` (the map of the whole
 * repo); a diff scan writes `report.diff.json` and never touches the map (BUG-03). Every reader goes
 * through {@link loadReportFile} so CLI, MCP and sinks agree on names and errors.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Report, type ReportType } from "@dustmap/contract";

export type ReportKind = "full" | "diff";

export const REPORT_KINDS: readonly ReportKind[] = ["full", "diff"];

export const REPORT_FILES: Record<ReportKind, string> = {
  full: "report.json",
  diff: "report.diff.json",
};

export function reportFilePath(outputDir: string, kind: ReportKind): string {
  return path.join(outputDir, REPORT_FILES[kind]);
}

export function isReportKind(value: string): value is ReportKind {
  return (REPORT_KINDS as readonly string[]).includes(value);
}

/** Parse the report of `kind`; a missing file names the scan that would create it. */
export function loadReportFile(outputDir: string, kind: ReportKind = "full"): ReportType {
  const file = reportFilePath(outputDir, kind);
  if (!existsSync(file)) {
    const how = kind === "full" ? "a full scan (dustmap scan / dustmap_scan mode full)" : "a diff scan (dustmap scan --diff <ref> / dustmap_scan mode diff)";
    throw new Error(`No ${REPORT_FILES[kind]} under ${outputDir}. Run ${how} first.`);
  }
  return Report.parse(JSON.parse(readFileSync(file, "utf8")));
}
