/**
 * Shared helpers for the file-based agent queue (docs/briefs/queue.json).
 * Ported in spirit from the Monorepo-A agent-continue tooling: Node only, no PowerShell.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const queuePath = path.join(root, "docs/briefs/queue.json");

export const STATUSES = ["todo", "in_progress", "done", "blocked", "cancelled"];
export const KINDS = ["feature", "bug"];
export const SEVERITIES = ["critical", "high", "medium", "low"];

export function loadQueue() {
  return JSON.parse(readFileSync(queuePath, "utf8"));
}

export function saveQueue(queue) {
  writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
}

export function gatesDone(task, byId) {
  return (task.gates ?? []).every((g) => byId.get(g)?.status === "done");
}

export function eligible(queue, kind) {
  const byId = new Map(queue.tasks.map((t) => [t.id, t]));
  const pool = queue.tasks.filter((t) => t.kind === kind && t.status === "todo" && !t.requiresCaptain && gatesDone(t, byId));
  if (kind === "bug") {
    const rank = (t) => SEVERITIES.indexOf(t.severity);
    pool.sort((a, b) => rank(a) - rank(b) || a.layer - b.layer);
  }
  return pool;
}

export function briefExists(task) {
  return existsSync(path.join(root, task.brief));
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const [key, inline] = a.slice(2).split("=", 2);
    if (inline !== undefined) out[key] = inline;
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[key] = argv[++i];
    else out[key] = true;
  }
  return out;
}
