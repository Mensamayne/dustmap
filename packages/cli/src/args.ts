/**
 * CLI argv parsing for all dustmap verbs. Unknown flags → usage error (exit 2).
 */
import type { DecisionVerdictType } from "@dustmap/contract";

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
  out?: string;
  json: boolean;
};

export type InitArgs = {
  command: "init";
  repoPath: string;
  json: boolean;
};

export type ShowArgs = {
  command: "show";
  fingerprint: string;
  out?: string;
  json: boolean;
};

export type DecideArgs = {
  command: "decide";
  fingerprint: string;
  verdict: DecisionVerdictType;
  reason: string;
  by?: string;
  out?: string;
  json: boolean;
};

export type ExportArgs = {
  command: "export";
  to: "markdown" | "sarif";
  out?: string;
  file?: string;
};

export type RatchetArgs = {
  command: "ratchet";
  out?: string;
  updateBaseline: boolean;
  json: boolean;
};

export type ParsedArgs =
  | ScanArgs
  | SummaryArgs
  | InitArgs
  | ShowArgs
  | DecideArgs
  | ExportArgs
  | RatchetArgs
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
    const out = takeFlag(rest, "--out");
    rest = out.rest;
    const json = takeBool(rest, "--json");
    rest = json.rest;
    const unknown = rest.filter((a) => a.startsWith("-"));
    if (unknown.length) throw new UsageError(`Unknown flag: ${unknown[0]}`);
    return {
      command: "summary",
      ...(out.value !== undefined ? { out: out.value } : {}),
      json: json.on,
    };
  }

  if (command === "init") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
    const json = takeBool(rest, "--json");
    rest = json.rest;
    const unknown = rest.filter((a) => a.startsWith("-"));
    if (unknown.length) throw new UsageError(`Unknown flag: ${unknown[0]}`);
    const positional = rest.filter((a) => !a.startsWith("-"));
    return {
      command: "init",
      repoPath: positional[0] ?? ".",
      json: json.on,
    };
  }

  if (command === "show") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
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
      fingerprint,
      ...(out.value !== undefined ? { out: out.value } : {}),
      json: json.on,
    };
  }

  if (command === "decide") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
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
      to: to.value,
      ...(out.value !== undefined ? { out: out.value } : {}),
      ...(file.value !== undefined ? { file: file.value } : {}),
    };
  }

  if (command === "ratchet") {
    const h = stripHelp(rest);
    if (h.help) return { command: "help" };
    rest = h.rest;
    const out = takeFlag(rest, "--out");
    rest = out.rest;
    const update = takeBool(rest, "--update-baseline");
    rest = update.rest;
    const json = takeBool(rest, "--json");
    rest = json.rest;
    const unknown = rest.filter((a) => a.startsWith("-"));
    if (unknown.length) throw new UsageError(`Unknown flag: ${unknown[0]}`);
    return {
      command: "ratchet",
      ...(out.value !== undefined ? { out: out.value } : {}),
      updateBaseline: update.on,
      json: json.on,
    };
  }

  throw new UsageError(
    `Unknown command: ${command}. Try: dustmap init|scan|summary|show|decide|export|ratchet`,
  );
}

export const HELP = `dustmap — report-only map of dead code, duplicates and refactor signals

Usage:
  dustmap init [path] [--json]
  dustmap scan [path] [--diff <ref>] [--config <file>] [--out <dir>] [--commit <sha>] [--json]
  dustmap summary [--out <dir>] [--json]
  dustmap show <fingerprint> [--out <dir>] [--json]
  dustmap decide <fingerprint> keep|fix|wontfix --reason "…" [--by <who>] [--out <dir>] [--json]
  dustmap export --to markdown|sarif [--out <dir>] [--file <path>]
  dustmap ratchet [--update-baseline] [--out <dir>] [--json]

From this monorepo (npm 11+ eats lone --flags):
  npm run dustmap -- -- scan <path> --out <dir>
  node packages/cli/bin/dustmap.mjs scan <path> --out <dir>

Exit codes: 0 OK, 1 ratchet found new findings, 2 usage or config error.
Never edits scanned source (writes only under --out / outputDir, plus init's config file).
`;
