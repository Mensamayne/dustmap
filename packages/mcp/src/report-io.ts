/**
 * Shared report / outputDir / git HEAD helpers for MCP tools (mirrors CLI; no CLI import).
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { FindingType, ReportType } from "@dustmap/contract";
import {
  defaultConfig,
  loadConfig,
  loadReportFile,
  resolveOutputDir,
  type ReportKind,
} from "@dustmap/core";

export function resolveMcpOutputDir(cwd: string, out?: string): string {
  if (out) return path.resolve(cwd, out);
  const config = existsSync(path.join(cwd, "dustmap.config.json"))
    ? loadConfig(cwd).config
    : defaultConfig();
  return resolveOutputDir(cwd, config.outputDir);
}

/** Full map (`report.json`) by default; `diff` reads `report.diff.json` (BUG-03). */
export function loadReportOrThrow(outDir: string, kind: ReportKind = "full"): ReportType {
  return loadReportFile(outDir, kind);
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
