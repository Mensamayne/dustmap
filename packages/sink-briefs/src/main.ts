/**
 * dustmap-briefs CLI — enqueue selected Dustmap fingerprints into a file queue.
 */
import { enqueueFingerprints } from "./enqueue.js";

export { enqueueFingerprints } from "./enqueue.js";
export { renderBrief, titleForFinding } from "./template.js";
export {
  findBySource,
  loadQueueFile,
  nextId,
  sourceKey,
} from "./queue-io.js";

const HELP = `dustmap-briefs — turn selected Dustmap findings into file-queue briefs

Usage:
  dustmap-briefs enqueue <fingerprint…> [--out <dir>] [--config <file>]

Only listed fingerprints are enqueued (never the whole report).
Same fingerprint twice → no second brief or queue row.
`;

export type Parsed =
  | { command: "help" }
  | {
      command: "enqueue";
      fingerprints: string[];
      out?: string;
      config?: string;
    };

export class UsageError extends Error {
  readonly code = "usage";
  constructor(message: string) {
    super(message);
    this.name = "UsageError";
  }
}

export function parseArgs(argv: string[]): Parsed {
  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
    return { command: "help" };
  }
  const command = argv[0];
  if (command !== "enqueue") {
    throw new UsageError(`Unknown command: ${command}. Try: dustmap-briefs enqueue`);
  }

  let rest = argv.slice(1);
  let out: string | undefined;
  let config: string | undefined;
  const fingerprints: string[] = [];

  while (rest.length > 0) {
    const a = rest[0]!;
    if (a === "--out") {
      if (!rest[1] || rest[1].startsWith("-")) throw new UsageError("Flag --out requires a value");
      out = rest[1];
      rest = rest.slice(2);
      continue;
    }
    if (a === "--config") {
      if (!rest[1] || rest[1].startsWith("-")) throw new UsageError("Flag --config requires a value");
      config = rest[1];
      rest = rest.slice(2);
      continue;
    }
    if (a.startsWith("-")) {
      throw new UsageError(`Unknown flag: ${a}`);
    }
    fingerprints.push(a);
    rest = rest.slice(1);
  }

  return {
    command: "enqueue",
    fingerprints,
    ...(out !== undefined ? { out } : {}),
    ...(config !== undefined ? { config } : {}),
  };
}

async function main(argv = process.argv.slice(2)): Promise<number> {
  let parsed: Parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n`);
      return 2;
    }
    throw err;
  }

  if (parsed.command === "help") {
    process.stdout.write(HELP);
    return 0;
  }

  const result = enqueueFingerprints({
    cwd: process.cwd(),
    fingerprints: parsed.fingerprints,
    ...(parsed.out !== undefined ? { out: parsed.out } : {}),
    ...(parsed.config !== undefined ? { configPath: parsed.config } : {}),
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.exitCode;
}

const isDirect =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("main.ts") || process.argv[1].endsWith("main.js"));

if (isDirect) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    },
  );
}
