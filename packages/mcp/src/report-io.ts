/**
 * Shared report / outputDir / git HEAD helpers for MCP tools (mirrors CLI; no CLI import).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Report, type FindingType, type ReportType } from "@dustmap/contract";
import { defaultConfig, loadConfig, resolveOutputDir } from "@dustmap/core";

export function resolveMcpOutputDir(cwd: string, out?: string): string {
  if (out) return path.resolve(cwd, out);
  const config = existsSync(path.join(cwd, "dustmap.config.json"))
    ? loadConfig(cwd).config
    : defaultConfig();
  return resolveOutputDir(cwd, config.outputDir);
}

export function loadReportOrThrow(outDir: string): ReportType {
  const reportPath = path.join(outDir, "report.json");
  if (!existsSync(reportPath)) {
    throw new Error(`No report.json under ${outDir}. Run dustmap_scan first.`);
  }
  return Report.parse(JSON.parse(readFileSync(reportPath, "utf8")));
}

export function findFinding(
  report: ReportType,
  fingerprint: string,
): FindingType | undefined {
  return report.findings.find((f) => f.fingerprint === fingerprint);
}

export function gitHead(cwd: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}
