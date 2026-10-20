/**
 * `dustmap init` — create dustmap.config.json when missing (never overwrites).
 * Optional `--agent` wires marked instruction blocks from the playbook (DUST-17).
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { runInit } from "@dustmap/core";
import type { InitArgs } from "./args.js";
import { runInitAgent } from "./init-agent.js";

export type CmdResult = { exitCode: 0 | 2; stdout: string; stderr: string };

export function runInitCommand(args: InitArgs): CmdResult {
  const repoRoot = path.resolve(args.repoPath);
  if (!existsSync(repoRoot)) {
    return { exitCode: 2, stdout: "", stderr: `Path does not exist: ${repoRoot}\n` };
  }

  const result = runInit(repoRoot);

  let agentOut = "";
  if (args.agent) {
    const agentResult = runInitAgent({
      repoPath: repoRoot,
      agent: args.agent,
      dry: args.dry,
    });
    if (agentResult.exitCode !== 0) {
      return {
        exitCode: 2,
        stdout: "",
        stderr: agentResult.stderr,
      };
    }
    agentOut = agentResult.stdout;
  } else if (args.dry) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "Flag --dry requires --agent\n",
    };
  }

  if (args.json) {
    return {
      exitCode: 0,
      stdout: `${JSON.stringify(
        {
          wrote: result.wrote,
          configPath: result.configPath,
          entryPoints: result.config.entryPoints,
          agent: args.agent ?? null,
          dry: args.dry,
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
  ];
  if (!args.agent) {
    lines.push(
      `dalej: dustmap scan ${repoRoot === process.cwd() ? "." : repoRoot}`,
    );
  }

  const stdout = `${lines.join("\n")}\n${agentOut}`;
  return { exitCode: 0, stdout, stderr: "" };
}
