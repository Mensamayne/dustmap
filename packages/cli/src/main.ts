/**
 * Dustmap CLI main — dispatches scan / summary. Writes only under outputDir; never edits scan target.
 */
import { HELP, parseArgs, UsageError } from "./args.js";
import { runScanCommand } from "./scan-cmd.js";
import { runSummaryCommand } from "./summary-cmd.js";

async function main(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    const msg = err instanceof UsageError ? err.message : String(err);
    process.stderr.write(`${msg}\n\n${HELP}`);
    return 2;
  }

  if (parsed.command === "help") {
    process.stdout.write(HELP);
    return 0;
  }

  if (parsed.command === "scan") {
    try {
      const result = await runScanCommand(parsed);
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      return result.exitCode;
    } catch (err) {
      if (err instanceof UsageError) {
        process.stderr.write(`${err.message}\n\n${HELP}`);
        return 2;
      }
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      return 1;
    }
  }

  if (parsed.command === "summary") {
    const result = runSummaryCommand(parsed);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return result.exitCode;
  }

  process.stderr.write(HELP);
  return 2;
}

const code = await main(process.argv.slice(2));
process.exit(code);
