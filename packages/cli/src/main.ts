/**
 * Dustmap CLI main — dispatches all verbs. Writes only under outputDir (and init config); never edits scan target.
 */
import { HELP, parseArgs, UsageError } from "./args.js";
import { runDecideCommand } from "./decide-cmd.js";
import { runExportCommand } from "./export/export-cmd.js";
import { runInitCommand } from "./init-cmd.js";
import { runListCommand } from "./list-cmd.js";
import { runRatchetCommand } from "./ratchet-cmd.js";
import { runScanCommand } from "./scan-cmd.js";
import { runShowCommand } from "./show-cmd.js";
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

  const write = (r: { exitCode: number; stdout: string; stderr: string }) => {
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    return r.exitCode;
  };

  try {
    switch (parsed.command) {
      case "init":
        return write(runInitCommand(parsed));
      case "scan":
        return write(await runScanCommand(parsed));
      case "summary":
        return write(runSummaryCommand(parsed));
      case "list":
        return write(runListCommand(parsed));
      case "show":
        return write(runShowCommand(parsed));
      case "decide":
        return write(runDecideCommand(parsed));
      case "export":
        return write(runExportCommand(parsed));
      case "ratchet":
        return write(runRatchetCommand(parsed));
      default:
        process.stderr.write(HELP);
        return 2;
    }
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n\n${HELP}`);
      return 2;
    }
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  }
}

const code = await main(process.argv.slice(2));
process.exit(code);
