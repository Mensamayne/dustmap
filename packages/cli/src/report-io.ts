/**
 * Shared report / outputDir helpers for CLI verbs that read an existing scan.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Report, type ReportType } from "@dustmap/contract";
import { defaultConfig, loadConfig, resolveOutputDir } from "@dustmap/core";

export function resolveCliOutputDir(cwd: string, out?: string): string {
  if (out) return path.resolve(cwd, out);
  const config = existsSync(path.join(cwd, "dustmap.config.json"))
    ? loadConfig(cwd).config
    : defaultConfig();
  return resolveOutputDir(cwd, config.outputDir);
}

export function loadReportOrThrow(outDir: string): ReportType {
  const reportPath = path.join(outDir, "report.json");
  if (!existsSync(reportPath)) {
    throw new Error(`No report.json under ${outDir}. Run: dustmap scan --out ${outDir}`);
  }
  return Report.parse(JSON.parse(readFileSync(reportPath, "utf8")));
}

export function findFinding(report: ReportType, fingerprint: string) {
  return report.findings.find((f) => f.fingerprint === fingerprint);
}
