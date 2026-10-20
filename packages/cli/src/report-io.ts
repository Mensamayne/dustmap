/**
 * Shared report / outputDir helpers for CLI verbs that read an existing scan.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import type { ReportType } from "@dustmap/contract";
import {
  defaultConfig,
  loadConfig,
  loadReportFile,
  resolveOutputDir,
  type ReportKind,
} from "@dustmap/core";

export function resolveCliOutputDir(cwd: string, out?: string): string {
  if (out) return path.resolve(cwd, out);
  const config = existsSync(path.join(cwd, "dustmap.config.json"))
    ? loadConfig(cwd).config
    : defaultConfig();
  return resolveOutputDir(cwd, config.outputDir);
}

/** Full map (`report.json`) by default; `diff` reads `report.diff.json` from `scan --diff`. */
export function loadReportOrThrow(outDir: string, kind: ReportKind = "full"): ReportType {
  return loadReportFile(outDir, kind);
}

/** ` --report diff` for follow-up commands that must keep reading the diff report; empty for the map. */
export function reportFlag(kind: ReportKind): string {
  return kind === "diff" ? " --report diff" : "";
}

export function findFinding(report: ReportType, fingerprint: string) {
  return report.findings.find((f) => f.fingerprint === fingerprint);
}
