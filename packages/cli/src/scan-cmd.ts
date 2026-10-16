/**
 * `dustmap scan` — run builtin adapters, write report under outputDir only.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import {
  builtinAdapters,
  loadConfig,
  resolveOutputDir,
  runScan,
} from "@dustmap/core";
import type { ScanArgs } from "./args.js";
import { UsageError } from "./args.js";

export type ScanCommandResult = {
  exitCode: 0 | 2;
  stdout: string;
  stderr: string;
};

export async function runScanCommand(args: ScanArgs): Promise<ScanCommandResult> {
  const repoRoot = path.resolve(args.repoPath);
  if (!existsSync(repoRoot)) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `Scan path does not exist: ${repoRoot}\n`,
    };
  }
  if (args.diff !== undefined && args.diff.trim() === "") {
    throw new UsageError("Flag --diff requires a non-empty ref");
  }

  let configPath = args.config ? path.resolve(args.config) : undefined;
  if (configPath && !existsSync(configPath)) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `Config file not found: ${configPath}\n`,
    };
  }

  try {
    loadConfig(repoRoot, configPath);
  } catch (err) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `${err instanceof Error ? err.message : String(err)}\n`,
    };
  }

  const loaded = loadConfig(repoRoot, configPath);
  const outputDir = args.out
    ? path.resolve(args.out)
    : resolveOutputDir(repoRoot, loaded.config.outputDir);

  const mode = args.diff ? "diff" : "full";
  const result = await runScan({
    repoRoot,
    mode,
    adapters: builtinAdapters(),
    outputDir,
    ...(args.diff ? { baseRef: args.diff } : {}),
    ...(configPath ? { configPath } : {}),
    ...(args.commit ? { commit: args.commit } : {}),
  });

  const { byCategory, topPlaces } = result.report.summary;
  const cats = Object.entries(byCategory)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}:${n}`)
    .join(" ");

  const lines: string[] = [];
  if (args.json) {
    lines.push(JSON.stringify(result.report, null, 2));
  } else {
    lines.push(
      `Scanned ${result.filesScanned.length} files · ${result.report.findings.length} findings` +
        (cats ? ` · ${cats}` : ""),
    );
    if (topPlaces.length > 0) {
      lines.push("Top places:");
      for (const [i, p] of topPlaces.slice(0, 10).entries()) {
        lines.push(
          `  ${i + 1}. ${p.path}  score=${p.score.toFixed(1)}  signals=${p.findingFingerprints.length}`,
        );
      }
    }
    lines.push(`Report: ${result.reportPath}`);
    lines.push(`dalej: dustmap summary --out ${outputDir}`);
  }

  return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" };
}
