#!/usr/bin/env node
/**
 * Pick the next eligible task (todo, all gates done) and mark it in_progress.
 * Usage: node tools/queue/next.mjs [--bug] [--dry] [--by <name>]
 */
import { loadQueue, saveQueue, eligible, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const kind = args.bug ? "bug" : "feature";
/** npm expands `--dry` to `--dry-run`; accept both. */
const dry = Boolean(args.dry || args["dry-run"]);
const queue = loadQueue();

const resumed = queue.tasks.find((t) => t.kind === kind && t.status === "in_progress");
const next = resumed ?? eligible(queue, kind)[0];

if (!next) {
  console.log(`Brak zadań (${kind}) gotowych do pracy.`);
  process.exit(0);
}

if (!resumed && !dry) {
  next.status = "in_progress";
  next.startedAt = new Date().toISOString();
  next.startedBy = typeof args.by === "string" ? args.by : "agent";
  saveQueue(queue);
}

console.log(`TASK: ${next.id} — ${next.title}${resumed ? " (wznowione, już w toku)" : ""}`);
console.log(`BRIEF: ${next.brief}`);
console.log(`GATES: ${(next.gates ?? []).join(", ") || "brak"}`);
console.log(`NEXT: przeczytaj brief, zrób Plan, uruchom Weryfikacja, commit "Fixes ${next.id}: …", potem npm run queue:close -- --id ${next.id}`);
