#!/usr/bin/env node
/**
 * Print the plan for a whole epic: briefs in gate order, with what each waits for.
 * Usage: node tools/queue/next-epic.mjs [--epic <ID>]
 * Without --epic: the epic of the first eligible feature task.
 */
import { loadQueue, eligible, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const queue = loadQueue();
const epic = typeof args.epic === "string" ? args.epic : eligible(queue, "feature")[0]?.epic;

if (!epic) {
  console.log("Brak epiku z zadaniami gotowymi do pracy.");
  process.exit(0);
}

const tasks = queue.tasks.filter((t) => t.epic === epic);
const open = tasks.filter((t) => t.status === "todo" || t.status === "in_progress");
const byId = new Map(queue.tasks.map((t) => [t.id, t]));

// Topological order over open tasks (Kahn), ties broken by layer. Gates on tasks from another epic
// do not order this epic — they are shown as waits; only gates inside the epic can form a cycle.
const ordered = [];
const placed = new Set(tasks.filter((t) => t.status === "done").map((t) => t.id));
const external = (g) => byId.get(g) !== undefined && byId.get(g).epic !== epic;
let pending = [...open].sort((a, b) => a.layer - b.layer);
while (pending.length) {
  const ready = pending.filter((t) =>
    (t.gates ?? []).every((g) => placed.has(g) || byId.get(g)?.status === "done" || external(g)),
  );
  if (!ready.length) {
    ordered.push(...pending.map((t) => ({ ...t, cycle: true })));
    break;
  }
  for (const t of ready) {
    ordered.push(t);
    placed.add(t.id);
  }
  pending = pending.filter((t) => !placed.has(t.id));
}

const overview = tasks.find((t) => /-00$/.test(t.id));
console.log(`EPIC: ${epic} (${tasks.length - open.length}/${tasks.length} done)`);
if (overview) console.log(`OVERVIEW: ${overview.brief}`);
console.log("PLAN:");
for (const t of ordered) {
  const waits = (t.gates ?? [])
    .filter((g) => byId.get(g)?.status !== "done")
    .map((g) => (external(g) ? `${g} (epik ${byId.get(g).epic})` : g));
  const tag = t.cycle ? " [CYKL W GATES]" : waits.length ? ` [waits for: ${waits.join(", ")}]` : "";
  console.log(`  ${t.id} ${t.status === "in_progress" ? "(w toku) " : ""}— ${t.title}${tag}`);
}
