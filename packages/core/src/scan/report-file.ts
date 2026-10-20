/**
 * Which file under outputDir holds which report. A full scan owns `report.json` (the map of the whole
 * repo); a diff scan writes `report.diff.json` and never touches the map (BUG-03). Every reader goes
 * through {@link loadReportFile} so CLI, MCP and sinks agree on names and errors.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

/**
 * Local note of which repo the reports in `outputDir` describe (absolute path, this machine only —
 * never inside the portable report.json). Freshness checks compare against that repo's HEAD (BUG-09).
 */
export const SCAN_TARGET_FILE = "scan-target.json";

export function writeScanTarget(outputDir: string, repoRoot: string): void {
  writeFileSync(path.join(outputDir, SCAN_TARGET_FILE), `${JSON.stringify({ repoRoot }, null, 2)}\n`, "utf8");
}

/** Repo the reports were scanned from, when this machine still has it; otherwise null. */
export function readScanTarget(outputDir: string): string | null {
  try {
    const { repoRoot } = JSON.parse(readFileSync(path.join(outputDir, SCAN_TARGET_FILE), "utf8")) as { repoRoot?: unknown };
    return typeof repoRoot === "string" && existsSync(repoRoot) ? repoRoot : null;
  } catch {
    return null;
  }
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
