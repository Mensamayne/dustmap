/**
 * `dustmap init` — create dustmap.config.json when missing (never overwrites).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { runInit } from "@dustmap/core";

export type InitArgs = {
  command: "init";
  repoPath: string;
  json: boolean;
};

export type CmdResult = { exitCode: 0 | 2; stdout: string; stderr: string };

export function runInitCommand(args: InitArgs): CmdResult {
  const repoRoot = path.resolve(args.repoPath);
  if (!existsSync(repoRoot)) {
    return { exitCode: 2, stdout: "", stderr: `Path does not exist: ${repoRoot}\n` };
  }
  const result = runInit(repoRoot);
  if (args.json) {
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(
        {
          wrote: result.wrote,
          configPath: result.configPath,
          entryPoints: result.config.entryPoints,
          detected: {
            frameworks: result.detected.frameworks,
            entryPoints: result.detected.entryPoints,
          },
        },
        null,
        2,
      )}\n`,
      stderr: "",
    };
  }
  const lines = [
    result.wrote
      ? `Wrote ${result.configPath}`
      : `Config already exists: ${result.configPath} (left unchanged)`,
    `Entry points: ${result.config.entryPoints.length}`,
    `dalej: dustmap scan ${repoRoot === process.cwd() ? "." : repoRoot}`,
  ];
  return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "" };
}
