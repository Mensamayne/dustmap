/**
 * `dustmap init --agent` — write marked instruction blocks for Claude / Cursor / Codex
 * from packages/cli/agent/PLAYBOOK.md. Never overwrites unmarked user content.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BEGIN_MARK = "<!-- dustmap:begin -->";
export const END_MARK = "<!-- dustmap:end -->";

export type AgentTarget = "claude" | "cursor" | "codex" | "all";

export type InitAgentArgs = {
  repoPath: string;
  agent: AgentTarget;
  dry: boolean;
};

export type FilePlan = {
  path: string;
  /** Full file contents after change. */
  next: string;
  /** Previous contents (empty if new file). */
  prev: string;
  changed: boolean;
};

export type InitAgentResult = {
  exitCode: 0 | 2;
  stdout: string;
  stderr: string;
  plans: FilePlan[];
};

function playbookPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.join(here, "..", "agent", "PLAYBOOK.md");
}

export function loadPlaybook(): string {
  const p = playbookPath();
  if (!existsSync(p)) {
    throw new Error(`Playbook missing: ${p}`);
  }
  return readFileSync(p, "utf8");
}

/** Replace or insert a marked block; bytes outside markers stay identical. */
export function upsertMarkedBlock(
  existing: string,
  body: string,
  begin = BEGIN_MARK,
  end = END_MARK,
): string {
  const block = `${begin}\n${body.trimEnd()}\n${end}`;
  const start = existing.indexOf(begin);
  const stop = existing.indexOf(end);
  if (start >= 0 && stop > start) {
    const afterEnd = stop + end.length;
    return existing.slice(0, start) + block + existing.slice(afterEnd);
  }
  if (existing.trim().length === 0) {
    return `${block}\n`;
  }
  const sep = existing.endsWith("\n") ? "\n" : "\n\n";
  return `${existing.replace(/\s*$/, "")}${sep}${block}\n`;
}

function skillBody(playbook: string): string {
  return `---
name: dustmap
description: >-
  Report-only dead-code / duplicate / refactor map for this repo. Use Dustmap
  MCP tools or CLI per the playbook. Never delete without verifyHint.
---

${playbook.trim()}
`;
}

function cursorRuleBody(playbook: string): string {
  return `---
description: Dustmap hygiene map — report-only; follow the agent loop
alwaysApply: false
---

${playbook.trim()}
`;
}

function agentsSection(playbook: string): string {
  return `## Dustmap

${playbook.trim()}
`;
}

function mcpServerEntry(repoRoot: string): Record<string, unknown> {
  // Prefer workspace bin when present; else npx-style placeholder the user can edit.
  const localBin = path.join(repoRoot, "node_modules", "@dustmap", "mcp", "bin", "dustmap-mcp.mjs");
  const monoBin = path.join(repoRoot, "packages", "mcp", "bin", "dustmap-mcp.mjs");
  let command = "npx";
  let args = ["-y", "@dustmap/mcp"];
  if (existsSync(monoBin)) {
    command = "node";
    args = [monoBin];
  } else if (existsSync(localBin)) {
    command = "node";
    args = [localBin];
  }
  return {
    command,
    args,
  };
}

function upsertMcpJson(existingRaw: string, server: Record<string, unknown>): string {
  let doc: Record<string, unknown> = {};
  if (existingRaw.trim()) {
    try {
      doc = JSON.parse(existingRaw) as Record<string, unknown>;
    } catch {
      throw new Error("Existing MCP JSON is invalid; refuse to overwrite");
    }
  }
  const servers =
    doc.mcpServers && typeof doc.mcpServers === "object" && !Array.isArray(doc.mcpServers)
      ? { ...(doc.mcpServers as Record<string, unknown>) }
      : {};
  servers.dustmap = server;
  const next = { ...doc, mcpServers: servers };
  return `${JSON.stringify(next, null, 2)}\n`;
}

function planFile(abs: string, next: string): FilePlan {
  const prev = existsSync(abs) ? readFileSync(abs, "utf8") : "";
  return {
    path: abs,
    next,
    prev,
    changed: prev !== next,
  };
}

export function planAgentFiles(args: InitAgentArgs): FilePlan[] {
  const root = path.resolve(args.repoPath);
  const playbook = loadPlaybook();
  const targets: AgentTarget[] =
    args.agent === "all" ? ["claude", "cursor", "codex"] : [args.agent];

  const plans: FilePlan[] = [];

  if (targets.includes("claude")) {
    const skillPath = path.join(root, ".claude", "skills", "dustmap", "SKILL.md");
    const prev = existsSync(skillPath) ? readFileSync(skillPath, "utf8") : "";
    const next = upsertMarkedBlock(prev, skillBody(playbook));
    plans.push(planFile(skillPath, next));
  }

  if (targets.includes("cursor")) {
    const rulePath = path.join(root, ".cursor", "rules", "dustmap.mdc");
    const prevRule = existsSync(rulePath) ? readFileSync(rulePath, "utf8") : "";
    plans.push(planFile(rulePath, upsertMarkedBlock(prevRule, cursorRuleBody(playbook))));

    const cursorMcp = path.join(root, ".cursor", "mcp.json");
    const prevMcp = existsSync(cursorMcp) ? readFileSync(cursorMcp, "utf8") : "";
    plans.push(planFile(cursorMcp, upsertMcpJson(prevMcp, mcpServerEntry(root))));
  }

  if (targets.includes("codex") || args.agent === "all") {
    const agentsPath = path.join(root, "AGENTS.md");
    const prev = existsSync(agentsPath) ? readFileSync(agentsPath, "utf8") : "";
    plans.push(planFile(agentsPath, upsertMarkedBlock(prev, agentsSection(playbook))));
  }

  if (args.agent === "all" || args.agent === "claude") {
    const mcpPath = path.join(root, ".mcp.json");
    const prev = existsSync(mcpPath) ? readFileSync(mcpPath, "utf8") : "";
    plans.push(planFile(mcpPath, upsertMcpJson(prev, mcpServerEntry(root))));
  }

  return plans;
}

function formatDry(plans: FilePlan[], root: string): string {
  const lines: string[] = ["dry-run: no files written"];
  for (const p of plans) {
    const rel = path.relative(root, p.path).replace(/\\/g, "/");
    if (!p.changed) {
      lines.push(`  unchanged ${rel}`);
      continue;
    }
    lines.push(`  would update ${rel} (${p.prev.length} → ${p.next.length} bytes)`);
  }
  return `${lines.join("\n")}\n`;
}

export function runInitAgent(args: InitAgentArgs): InitAgentResult {
  const root = path.resolve(args.repoPath);
  if (!existsSync(root)) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `Path does not exist: ${root}\n`,
      plans: [],
    };
  }

  let plans: FilePlan[];
  try {
    plans = planAgentFiles(args);
  } catch (err) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `${err instanceof Error ? err.message : String(err)}\n`,
      plans: [],
    };
  }

  if (args.dry) {
    return {
      exitCode: 0,
      stdout: formatDry(plans, root),
      stderr: "",
      plans,
    };
  }

  const written: string[] = [];
  for (const p of plans) {
    if (!p.changed) continue;
    mkdirSync(path.dirname(p.path), { recursive: true });
    writeFileSync(p.path, p.next, "utf8");
    written.push(path.relative(root, p.path).replace(/\\/g, "/"));
  }

  const lines =
    written.length === 0
      ? ["Agent files already up to date (zero changes).", `dalej: dustmap scan ${root === process.cwd() ? "." : root}`]
      : [
          `Updated agent wiring (${written.length} file(s)):`,
          ...written.map((w) => `  ${w}`),
          `dalej: dustmap scan ${root === process.cwd() ? "." : root}`,
        ];

  return { exitCode: 0, stdout: `${lines.join("\n")}\n`, stderr: "", plans };
}
