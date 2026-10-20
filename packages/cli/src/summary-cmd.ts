/**
 * `dustmap summary` — short view of an existing report (category counts, top places, age vs HEAD).
 */
import { execFileSync } from "node:child_process";
import type { ReportType } from "@dustmap/contract";
import type { SummaryArgs } from "./args.js";
import { loadReportOrThrow, resolveCliOutputDir } from "./report-io.js";

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
  const outDir = resolveCliOutputDir(cwd, args.out);

  let report: ReportType;
  try {
    report = loadReportOrThrow(outDir);
  } catch (err) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `${err instanceof Error ? err.message : String(err)}\n`,
    };
  }

  const head = gitHead(cwd);
  const freshness =
    head === null
      ? ({
          stale: "unknown" as const,
          headAvailable: false,
          staleWarning:
            `Cannot confirm report freshness: git HEAD is unavailable (empty repo or not a git checkout). ` +
            `Report commit ${report.scan.commit.slice(0, 12)}.`,
        } as const)
      : report.scan.commit === head
        ? ({ stale: false as const, headAvailable: true } as const)
        : ({
            stale: true as const,
            headAvailable: true,
            staleWarning: `Report commit ${report.scan.commit.slice(0, 12)} ≠ HEAD ${head.slice(0, 12)}.`,
          } as const);

  if (args.json) {
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(
        {
          summary: report.summary,
          scan: report.scan,
          findingCount: report.findings.length,
          stale: freshness.stale,
          headAvailable: freshness.headAvailable,
          ...(freshness.staleWarning ? { staleWarning: freshness.staleWarning } : {}),
          head: head ?? null,
        },
        null,
        2,
      )}\n`,
      stderr: "",
    };
  }

  const commitLine =
    freshness.stale === "unknown"
      ? `Cannot confirm freshness: git HEAD unavailable · report ${report.scan.commit.slice(0, 12)} · scanned ${ageLabel(report.scan.startedAt)}`
      : freshness.stale === false
        ? `Report matches HEAD (${head!.slice(0, 12)}) · scanned ${ageLabel(report.scan.startedAt)}`
        : `Report commit ${report.scan.commit.slice(0, 12)} ≠ HEAD ${head!.slice(0, 12)} · scanned ${ageLabel(report.scan.startedAt)}`;

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
  const topFp = report.summary.topPlaces[0]?.findingFingerprints[0];
  lines.push(
    topFp
      ? `dalej: dustmap show ${topFp} --out ${outDir}`
      : `dalej: dustmap summary --out ${outDir} --json`,
  );

  return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" };
}
