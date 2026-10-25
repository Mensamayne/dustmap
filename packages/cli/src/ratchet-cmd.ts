/**
 * `dustmap ratchet [--update-baseline]` — fail (exit 1) on new findings above confidence floor.
 */
import {
  checkRatchetAt,
  loadConfig,
  defaultConfig,
  updateBaseline,
  parseRatchetOptions,
} from "@dustmap/core";
import { existsSync } from "node:fs";
import path from "node:path";
import type { RatchetArgs } from "./args.js";
import { loadReportOrThrow, resolveCliOutputDir } from "./report-io.js";

export type CmdResult = { exitCode: 0 | 1 | 2; stdout: string; stderr: string };

export function runRatchetCommand(args: RatchetArgs, cwd = process.cwd()): CmdResult {
  const outDir = resolveCliOutputDir(cwd, args.out);
  let report;
  try {
    report = loadReportOrThrow(outDir, args.report);
  } catch (err) {
    return { exitCode: 2, stdout: "", stderr: `${err instanceof Error ? err.message : String(err)}\n` };
  }

  const config = existsSync(path.join(cwd, "dustmap.config.json"))
    ? loadConfig(cwd).config
    : defaultConfig();
  const options = parseRatchetOptions({
    minConfidence: config.ratchet.minConfidence,
  });

  if (args.updateBaseline) {
    const baseline = updateBaseline(outDir, report.findings, options);
    if (args.json) {
      return {
        exitCode: 0,
        stdout: `${JSON.stringify({ updated: true, fingerprints: baseline.fingerprints.length }, null, 2)}\n`,
        stderr: "",
      };
    }
    return {
      exitCode: 0,
      stdout: `Updated baseline with ${baseline.fingerprints.length} fingerprints (≥ ${options.minConfidence})\nnext: dustmap ratchet --out ${outDir}\n`,
      stderr: "",
    };
  }

  const result = checkRatchetAt(outDir, report.findings, options);
  if (args.json) {
    return {
      exitCode: result.exitCode,
      stdout: `${JSON.stringify(
        {
          exitCode: result.exitCode,
          baselineSize: result.baselineSize,
          newFindings: result.newFindings.map((f) => ({
            fingerprint: f.fingerprint,
            kind: f.kind,
            confidence: f.confidence,
          })),
        },
        null,
        2,
      )}\n`,
      stderr: "",
    };
  }

  if (result.exitCode === 0) {
    return {
      exitCode: 0,
      stdout: `Ratchet clean · baseline ${result.baselineSize} · no new findings ≥ ${options.minConfidence}\nnext: dustmap summary --out ${outDir}\n`,
      stderr: "",
    };
  }

  const lines = [
    `Ratchet failed · ${result.newFindings.length} new finding(s) ≥ ${options.minConfidence}`,
    ...result.newFindings.slice(0, 20).map((f) => {
      const loc = f.locations[0]?.path ?? "?";
      return `  - ${f.fingerprint} ${f.kind} ${f.confidence} ${loc}`;
    }),
    `next: dustmap ratchet --update-baseline --out ${outDir}`,
  ];
  return { exitCode: 1, stdout: `${lines.join("\n")}\n`, stderr: "" };
}
