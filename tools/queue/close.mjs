#!/usr/bin/env node
/**
 * Close a queue task. Requires a git commit referencing the id (TKR), unless --force.
 * Usage: node tools/queue/close.mjs --id DUST-01 [--note "…"] [--force]
 */
import { loadQueue, saveQueue, parseArgs, root } from "./lib.mjs";
import { loadTkrConfig, verifyGitProofForTask } from "../tkr/lib/git-proof.mjs";

const args = parseArgs(process.argv.slice(2));
/** Prefer --id; fall back to positional (npm 11+ swallows unknown --id as cli config). */
const id = typeof args.id === "string" && args.id ? args.id : typeof args._[0] === "string" ? args._[0] : "";
if (!id) {
  console.error(
    'Użycie: node tools/queue/close.mjs --id DUST-01 [--note "…"]\n' +
      '   lub: npm run queue:close -- -- --id DUST-01 [--note "…"]\n' +
      '   lub: npm run queue:close -- -- DUST-01 [--note "…"]',
  );
  process.exit(2);
}

const queue = loadQueue();
const task = queue.tasks.find((t) => t.id === id);
if (!task) {
  console.error(`Nie ma zadania ${id} w kolejce.`);
  process.exit(2);
}
if (task.status === "done") {
  console.log(`${id} jest już zamknięte.`);
  process.exit(0);
}

let sha = null;
if (!args.force && process.env.TKR_SKIP !== "1") {
  let proof;
  try {
    proof = verifyGitProofForTask(root, id, loadTkrConfig(root));
  } catch (err) {
    console.error(`STOP: nie da się odczytać historii git (repo bez commitów?). ${String(err.message).split("\n").at(-2) ?? ""}`);
    process.exit(1);
  }
  if (!proof.ok) {
    console.error(`STOP: ${proof.reason}`);
    process.exit(1);
  }
  sha = proof.proof?.sha ?? null;
}

task.status = "done";
task.completedAt = new Date().toISOString();
if (sha) task.gitProofSha = sha;
if (typeof args.note === "string") task.closureNotes = args.note.slice(0, 500);
saveQueue(queue);

console.log(`Zamknięte: ${id}${sha ? ` (commit ${sha.slice(0, 7)})` : " (bez dowodu commita — --force)"}`);
