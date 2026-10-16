/**
 * Minimal argv parsing for scan / summary. Unknown flags → usage error (exit 2).
 */
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

export type ParsedArgs = ScanArgs | SummaryArgs | { command: "help" };

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

export function parseArgs(argv: string[]): ParsedArgs {
  const rest0 = argv.filter((a) => a !== "--");
  if (rest0.length === 0 || rest0[0] === "help" || rest0[0] === "--help" || rest0[0] === "-h") {
    return { command: "help" };
  }

  const command = rest0[0]!;
  let rest = rest0.slice(1);

  if (command === "scan") {
    const help = takeBool(rest, "--help");
    rest = help.rest;
    const help2 = takeBool(rest, "-h");
    rest = help2.rest;
    if (help.on || help2.on) return { command: "help" };

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
    const help = takeBool(rest, "--help");
    rest = help.rest;
    const help2 = takeBool(rest, "-h");
    rest = help2.rest;
    if (help.on || help2.on) return { command: "help" };

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

  throw new UsageError(`Unknown command: ${command}. Try: dustmap scan | dustmap summary`);
}

export const HELP = `dustmap — report-only map of dead code, duplicates and refactor signals

Usage:
  dustmap scan [path] [--diff <ref>] [--config <file>] [--out <dir>] [--commit <sha>] [--json]
  dustmap summary [--out <dir>] [--json]

From this monorepo (npm 11+ eats lone --flags):
  npm run dustmap -- -- scan <path> --out <dir>
  node packages/cli/bin/dustmap.mjs scan <path> --out <dir>

Exit codes: 0 OK, 2 usage or config error.
Scan never edits the scanned repo (writes only under --out / outputDir).
`;
