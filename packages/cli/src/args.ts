/**
 * CLI argv parsing for all dustmap verbs. Unknown flags → usage error (exit 2).
 */
import type { DecisionVerdictType } from "@dustmap/contract";
import { isReportKind, REPORT_KINDS, type ReportKind } from "@dustmap/core";

export type ScanArgs = {
  command: "scan";
  repoPath: string;
  diff?: string;
  config?: string;
  out?: string;
  commit?: string;
  json: boolean;
};

export type SummaryArgs = {
  command: "summary";
  /** full = report.json (the map), diff = report.diff.json (BUG-03). */
  report: ReportKind;
  out?: string;
  json: boolean;
};

export type AgentTarget = "claude" | "cursor" | "codex" | "all";

export type InitArgs = {
  command: "init";
  repoPath: string;
  json: boolean;
  /** When set, also wire agent instruction files from the playbook (DUST-17). */
  agent?: AgentTarget;
  dry: boolean;
};

export type ShowArgs = {
  command: "show";
  /** full = report.json (the map), diff = report.diff.json (BUG-03). */
  report: ReportKind;
  fingerprint: string;
  out?: string;
  json: boolean;
};

export type ListArgs = {
  command: "list";
  /** full = report.json (the map), diff = report.diff.json (BUG-03). */
  report: ReportKind;
  category?: string;
  minConfidence?: string;
  path?: string;
  offset?: number;
  limit?: number;
  out?: string;
  json: boolean;
};

export type DecideArgs = {
  command: "decide";
  /** full = report.json (the map), diff = report.diff.json (BUG-03). */
  report: ReportKind;
  fingerprint: string;
  verdict: DecisionVerdictType;
  reason: string;
  by?: string;
  out?: string;
  json: boolean;
};

export type ExportArgs = {
  command: "export";
  /** full = report.json (the map), diff = report.diff.json (BUG-03). */
  report: ReportKind;
  to: "markdown" | "sarif";
  out?: string;
  file?: string;
};

export type RatchetArgs = {
  command: "ratchet";
  /** full = report.json (the map), diff = report.diff.json (BUG-03). */
  report: ReportKind;
  out?: string;
  updateBaseline: boolean;
  json: boolean;
};

export type ModelPullArgs = {
  command: "model-pull";
  id: string;
  /** Base URL serving `<id>/manifest.json` and the files it lists. */
  from?: string;
  modelDir?: string;
  json: boolean;
};

export type ModelListArgs = {
  command: "model-list";
  modelDir?: string;
  json: boolean;
};

export type ParsedArgs =
  | ScanArgs
  | SummaryArgs
  | InitArgs
  | ShowArgs
  | ListArgs
  | DecideArgs
  | ExportArgs
  | RatchetArgs
  | ModelPullArgs
  | ModelListArgs
  | { command: "help" };

export class UsageError extends Error {
  readonly code = "usage";
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

function takeFlag(argv: string[], name: string): { value?: string; rest: string[] } {
  const i = argv.indexOf(name);
  if (i < 0) return { rest: argv };
  const value = argv[i + 1];
  if (!value || value.startsWith("-")) {
    throw new UsageError(`Flag ${name} requires a value`);
  }
  return { value, rest: [...argv.slice(0, i), ...argv.slice(i + 2)] };
}

function takeBool(argv: string[], name: string): { on: boolean; rest: string[] } {
  const i = argv.indexOf(name);
  if (i < 0) return { on: false, rest: argv };
  return { on: true, rest: [...argv.slice(0, i), ...argv.slice(i + 1)] };
}

function stripHelp(rest: string[]): { help: boolean; rest: string[] } {
  let r = rest;
  const a = takeBool(r, "--help");
  r = a.rest;
  const b = takeBool(r, "-h");
  r = b.rest;
  return { help: a.on || b.on, rest: r };
}

const VERDICTS = new Set(["keep", "fix", "wontfix"]);

function takeReport(argv: string[]): { kind: ReportKind; rest: string[] } {
  const r = takeFlag(argv, "--report");
  if (r.value === undefined) return { kind: "full", rest: r.rest };
  if (!isReportKind(r.value)) {
    throw new UsageError(`Flag --report must be one of: ${REPORT_KINDS.join(", ")} (got "${r.value}")`);
  }
  return { kind: r.value, rest: r.rest };
}

function parseCount(flag: string, value: string | undefined, min: number): number | undefined {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value) || Number(value) < min) {
    throw new UsageError(`Flag ${flag} must be an integer ≥ ${min} (got "${value}")`);
  }
  return Number(value);
}

export function parseArgs(argv: string[]): ParsedArgs {
  const rest0 = argv.filter((a) => a !== "--");
  if (rest0.length === 0 || rest0[0] === "help" || rest0[0] === "--help" || rest0[0] === "-h") {
    return { command: "help" };
  }

  const command = rest0[0]!;
  let rest = rest0.slice(1);

  if (command === "scan") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
    const diff = takeFlag(rest, "--diff");
    rest = diff.rest;
    const config = takeFlag(rest, "--config");
    rest = config.rest;
    const out = takeFlag(rest, "--out");
    rest = out.rest;
    const commit = takeFlag(rest, "--commit");
    rest = commit.rest;
    const json = takeBool(rest, "--json");
    rest = json.rest;
    const unknown = rest.filter((a) => a.startsWith("-"));
    if (unknown.length) throw new UsageError(`Unknown flag: ${unknown[0]}`);
    const positional = rest.filter((a) => !a.startsWith("-"));
    return {
      command: "scan",
      repoPath: positional[0] ?? ".",
      ...(diff.value !== undefined ? { diff: diff.value } : {}),
      ...(config.value !== undefined ? { config: config.value } : {}),
      ...(out.value !== undefined ? { out: out.value } : {}),
      ...(commit.value !== undefined ? { commit: commit.value } : {}),
      json: json.on,
    };
  }

  if (command === "summary") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
    const report = takeReport(rest);
    rest = report.rest;
    const out = takeFlag(rest, "--out");
    rest = out.rest;
    const json = takeBool(rest, "--json");
    rest = json.rest;
    const unknown = rest.filter((a) => a.startsWith("-"));
    if (unknown.length) throw new UsageError(`Unknown flag: ${unknown[0]}`);
    return {
      command: "summary",
      report: report.kind,
      ...(out.value !== undefined ? { out: out.value } : {}),
      json: json.on,
    };
  }

  if (command === "init") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
    const agent = takeFlag(rest, "--agent");
    rest = agent.rest;
    const dry = takeBool(rest, "--dry");
    rest = dry.rest;
    const json = takeBool(rest, "--json");
    rest = json.rest;
    const unknown = rest.filter((a) => a.startsWith("-"));
    if (unknown.length) throw new UsageError(`Unknown flag: ${unknown[0]}`);
    const positional = rest.filter((a) => !a.startsWith("-"));
    let agentTarget: AgentTarget | undefined;
    if (agent.value !== undefined) {
      if (!["claude", "cursor", "codex", "all"].includes(agent.value)) {
        throw new UsageError(
          "Usage: dustmap init [--agent claude|cursor|codex|all] [--dry] [path]",
        );
      }
      agentTarget = agent.value as AgentTarget;
    }
    return {
      command: "init",
      repoPath: positional[0] ?? ".",
      json: json.on,
      ...(agentTarget !== undefined ? { agent: agentTarget } : {}),
      dry: dry.on,
    };
  }

  if (command === "show") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
    const report = takeReport(rest);
    rest = report.rest;
    const out = takeFlag(rest, "--out");
    rest = out.rest;
    const json = takeBool(rest, "--json");
    rest = json.rest;
    const unknown = rest.filter((a) => a.startsWith("-"));
    if (unknown.length) throw new UsageError(`Unknown flag: ${unknown[0]}`);
    const positional = rest.filter((a) => !a.startsWith("-"));
    const fingerprint = positional[0];
    if (!fingerprint || !/^[a-f0-9]{16}$/.test(fingerprint)) {
      throw new UsageError("Usage: dustmap show <16-hex-fingerprint> [--out <dir>]");
    }
    return {
      command: "show",
      report: report.kind,
      fingerprint,
      ...(out.value !== undefined ? { out: out.value } : {}),
      json: json.on,
    };
  }

  if (command === "list") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
    const report = takeReport(rest);
    rest = report.rest;
    const category = takeFlag(rest, "--category");
    rest = category.rest;
    const minConfidence = takeFlag(rest, "--min-confidence");
    rest = minConfidence.rest;
    const pathPrefix = takeFlag(rest, "--path");
    rest = pathPrefix.rest;
    const offset = takeFlag(rest, "--offset");
    rest = offset.rest;
    const limit = takeFlag(rest, "--limit");
    rest = limit.rest;
    const out = takeFlag(rest, "--out");
    rest = out.rest;
    const json = takeBool(rest, "--json");
    rest = json.rest;
    const unknown = rest.filter((a) => a.startsWith("-"));
    if (unknown.length) throw new UsageError(`Unknown flag: ${unknown[0]}`);
    if (rest.length) throw new UsageError(`Unexpected argument: ${rest[0]}`);
    const offsetN = parseCount("--offset", offset.value, 0);
    const limitN = parseCount("--limit", limit.value, 1);
    return {
      command: "list",
      report: report.kind,
      ...(category.value !== undefined ? { category: category.value } : {}),
      ...(minConfidence.value !== undefined ? { minConfidence: minConfidence.value } : {}),
      ...(pathPrefix.value !== undefined ? { path: pathPrefix.value } : {}),
      ...(offsetN !== undefined ? { offset: offsetN } : {}),
      ...(limitN !== undefined ? { limit: limitN } : {}),
      ...(out.value !== undefined ? { out: out.value } : {}),
      json: json.on,
    };
  }

  if (command === "decide") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
    const report = takeReport(rest);
    rest = report.rest;
    const reason = takeFlag(rest, "--reason");
    rest = reason.rest;
    const by = takeFlag(rest, "--by");
    rest = by.rest;
    const out = takeFlag(rest, "--out");
    rest = out.rest;
    const json = takeBool(rest, "--json");
    rest = json.rest;
    const unknown = rest.filter((a) => a.startsWith("-"));
    if (unknown.length) throw new UsageError(`Unknown flag: ${unknown[0]}`);
    const positional = rest.filter((a) => !a.startsWith("-"));
    const fingerprint = positional[0];
    const verdict = positional[1];
    if (!fingerprint || !/^[a-f0-9]{16}$/.test(fingerprint)) {
      throw new UsageError(
        "Usage: dustmap decide <fingerprint> keep|fix|wontfix --reason \"…\" [--out <dir>]",
      );
    }
    if (!verdict || !VERDICTS.has(verdict)) {
      throw new UsageError("Verdict must be keep, fix, or wontfix");
    }
    if (!reason.value) {
      throw new UsageError("Flag --reason is required");
    }
    return {
      command: "decide",
      report: report.kind,
      fingerprint,
      verdict: verdict as DecisionVerdictType,
      reason: reason.value,
      ...(by.value !== undefined ? { by: by.value } : {}),
      ...(out.value !== undefined ? { out: out.value } : {}),
      json: json.on,
    };
  }

  if (command === "export") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
    const report = takeReport(rest);
    rest = report.rest;
    const to = takeFlag(rest, "--to");
    rest = to.rest;
    const out = takeFlag(rest, "--out");
    rest = out.rest;
    const file = takeFlag(rest, "--file");
    rest = file.rest;
    const unknown = rest.filter((a) => a.startsWith("-"));
    if (unknown.length) throw new UsageError(`Unknown flag: ${unknown[0]}`);
    if (to.value !== "markdown" && to.value !== "sarif") {
      throw new UsageError("Usage: dustmap export --to markdown|sarif [--out <dir>] [--file <path>]");
    }
    return {
      command: "export",
      report: report.kind,
      to: to.value,
      ...(out.value !== undefined ? { out: out.value } : {}),
      ...(file.value !== undefined ? { file: file.value } : {}),
    };
  }

  if (command === "ratchet") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
    const report = takeReport(rest);
    rest = report.rest;
    const out = takeFlag(rest, "--out");
    rest = out.rest;
    const update = takeBool(rest, "--update-baseline");
    rest = update.rest;
    const json = takeBool(rest, "--json");
    rest = json.rest;
    const unknown = rest.filter((a) => a.startsWith("-"));
    if (unknown.length) throw new UsageError(`Unknown flag: ${unknown[0]}`);
    if (update.on && report.kind === "diff") {
      throw new UsageError("--update-baseline reads the full map; drop --report diff");
    }
    return {
      command: "ratchet",
      report: report.kind,
      ...(out.value !== undefined ? { out: out.value } : {}),
      updateBaseline: update.on,
      json: json.on,
    };
  }

  if (command === "model") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
    const from = takeFlag(rest, "--from");
    rest = from.rest;
    const modelDir = takeFlag(rest, "--model-dir");
    rest = modelDir.rest;
    const json = takeBool(rest, "--json");
    rest = json.rest;
    const unknown = rest.filter((a) => a.startsWith("-"));
    if (unknown.length) throw new UsageError(`Unknown flag: ${unknown[0]}`);
    const [verb, id, ...extra] = rest;
    if (extra.length) throw new UsageError(`Unexpected argument: ${extra[0]}`);
    const dirOpt = modelDir.value !== undefined ? { modelDir: modelDir.value } : {};
    if (verb === "pull") {
      if (!id) throw new UsageError("dustmap model pull needs a model id");
      return { command: "model-pull", id, ...(from.value !== undefined ? { from: from.value } : {}), ...dirOpt, json: json.on };
    }
    if (verb === "list") {
      if (id) throw new UsageError(`Unexpected argument: ${id}`);
      if (from.value !== undefined) throw new UsageError("--from is only for model pull");
      return { command: "model-list", ...dirOpt, json: json.on };
    }
    throw new UsageError(`Unknown model command: ${verb ?? "(none)"}. Try: dustmap model pull <id> | dustmap model list`);
  }

  throw new UsageError(
    `Unknown command: ${command}. Try: dustmap init|scan|summary|list|show|decide|export|ratchet|model`,
  );
}

export const HELP = `dustmap — report-only map of dead code, duplicates and refactor signals

Usage:
  dustmap init [path] [--json] [--agent claude|cursor|codex|all] [--dry]
  dustmap scan [path] [--diff <ref>] [--config <file>] [--out <dir>] [--commit <sha>] [--json]
  dustmap summary [--report full|diff] [--out <dir>] [--json]
  dustmap list [--report full|diff] [--category <c>] [--path <prefix>] [--min-confidence low|medium|high] [--offset <n>] [--limit <n>] [--out <dir>] [--json]
  dustmap show <fingerprint> [--report full|diff] [--out <dir>] [--json]
  dustmap decide <fingerprint> keep|fix|wontfix --reason "…" [--by <who>] [--report full|diff] [--out <dir>] [--json]
  dustmap export --to markdown|sarif [--report full|diff] [--out <dir>] [--file <path>]
  dustmap ratchet [--update-baseline] [--report full|diff] [--out <dir>] [--json]
  dustmap model pull <id> [--from <url>] [--model-dir <dir>] [--json]
  dustmap model list [--model-dir <dir>] [--json]

Models: semantic.provider "onnx" runs a model package from the user's model directory, offline.
"model pull" is the only command that uses the network — only when you run it — and it refuses
private packages and any file whose SHA-256 differs from the package manifest.

Reports: a full scan writes report.json (the map of the whole repo); scan --diff writes
report.diff.json and never touches the map. Readers use the map unless --report diff.

From this monorepo (npm 11+ eats lone --flags):
  npm run dustmap -- -- scan <path> --out <dir>
  node packages/cli/bin/dustmap.mjs scan <path> --out <dir>

Exit codes: 0 OK, 1 ratchet found new findings, 2 usage or config error, 3 internal error.
Never edits scanned source (writes only under --out / outputDir, plus init's config file).
`;
