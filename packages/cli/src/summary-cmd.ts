/**
 * `dustmap summary` — short view of an existing report (category counts, top places, age vs HEAD).
 */
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { Report, type ReportType } from "@dustmap/contract";
import { resolveOutputDir, loadConfig, defaultConfig } from "@dustmap/core";
import type { SummaryArgs } from "./args.js";

export type SummaryCommandResult = {
  exitCode: 0 | 2;
  stdout: string;
  stderr: string;
};

function gitHead(cwd: string): string | null {
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

function loadReport(outDir: string): ReportType {
  const reportPath = path.join(outDir, "report.json");
  if (!existsSync(reportPath)) {
    throw new Error(`No report.json under ${outDir}. Run: dustmap scan --out ${outDir}`);
  }
  return Report.parse(JSON.parse(readFileSync(reportPath, "utf8")));
}

function ageLabel(startedAt: string): string {
  const ms = Date.now() - Date.parse(startedAt);
  if (!Number.isFinite(ms) || ms < 0) return startedAt;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export function runSummaryCommand(args: SummaryArgs, cwd = process.cwd()): SummaryCommandResult {
  const outDir = args.out
    ? path.resolve(cwd, args.out)
    : resolveOutputDir(cwd, (existsSync(path.join(cwd, "dustmap.config.json"))
        ? loadConfig(cwd).config
        : defaultConfig()
      ).outputDir);

  let report: ReportType;
  try {
    report = loadReport(outDir);
  } catch (err) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `${err instanceof Error ? err.message : String(err)}\n`,
    };
  }

  if (args.json) {
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(
        {
          summary: report.summary,
          scan: report.scan,
          findingCount: report.findings.length,
        },
        null,
        2,
      )}\n`,
      stderr: "",
    };
  }

  const head = gitHead(cwd);
  const commitLine =
    head === null
      ? `Report commit: ${report.scan.commit} · scanned ${ageLabel(report.scan.startedAt)}`
      : report.scan.commit === head
        ? `Report matches HEAD (${head.slice(0, 12)}) · scanned ${ageLabel(report.scan.startedAt)}`
        : `Report commit ${report.scan.commit.slice(0, 12)} ≠ HEAD ${head.slice(0, 12)} · scanned ${ageLabel(report.scan.startedAt)}`;

  const lines: string[] = [];
  lines.push(commitLine);
  lines.push(`Findings: ${report.findings.length}`);
  for (const [cat, n] of Object.entries(report.summary.byCategory)) {
    if (n > 0) lines.push(`  ${cat}: ${n}`);
  }
  lines.push("Top places:");
  const top = report.summary.topPlaces.slice(0, 10);
  if (top.length === 0) {
    lines.push("  (none)");
  } else {
    for (const [i, p] of top.entries()) {
      lines.push(
        `  ${i + 1}. ${p.path}  score=${p.score.toFixed(1)}  signals=${p.findingFingerprints.length}`,
      );
    }
  }
  lines.push(`dalej: dustmap summary --out ${outDir} --json`);

  return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" };
}
