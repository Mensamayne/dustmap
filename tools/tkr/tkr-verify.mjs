#!/usr/bin/env node
/**
 * Verify git commit proof for a queue task id.
 * Usage: node tools/tkr/tkr-verify.mjs --id U20-02 [--json]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadTkrConfig,
  resolveRepoRoot,
  verifyGitProofForTask,
} from "./lib/git-proof.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = resolveRepoRoot(path.resolve(__dirname, "../.."));

const args = process.argv.slice(2);
let taskId = "";
let jsonOut = false;
let force = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--id" && args[i + 1]) taskId = args[++i];
  else if (a === "--json") jsonOut = true;
  else if (a === "--force") force = true;
  else if (a.startsWith("--id=")) taskId = a.slice(5);
}

if (!taskId) {
  console.error("Usage: node tools/tkr/tkr-verify.mjs --id TASK-ID [--json] [--force]");
  process.exit(2);
}

const config = loadTkrConfig(root);
if (force || process.env.TKR_SKIP === "1") {
  if (jsonOut) console.log(JSON.stringify({ ok: true, skipped: true, reason: "force/skip" }));
  else console.log(`TKR_SKIP task=${taskId}`);
  process.exit(0);
}

const result = verifyGitProofForTask(root, taskId, config);

if (jsonOut) {
  console.log(JSON.stringify(result, null, 2));
} else if (result.ok) {
  if (result.exempt) {
    console.log(`OK exempt task=${taskId} reason=${result.reason}`);
  } else {
    console.log(`OK task=${taskId} sha=${result.proof.shortSha} subject=${result.proof.subject}`);
  }
} else {
  console.error(`FAIL task=${taskId}`);
  console.error(result.reason);
  console.error(`Expected commit message containing one of: ${result.needles?.join(" | ")}`);
}

process.exit(result.ok ? 0 : 1);
