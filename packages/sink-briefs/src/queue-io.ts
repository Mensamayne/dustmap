/**
 * Read/write a file-queue (queue.json) and allocate the next id for a prefix.
 * Idempotency key is task.source === `dustmap:<fingerprint>`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export type QueueTask = {
  id: string;
  title: string;
  layer: number;
  segment: string;
  brief: string;
  gates: string[];
  status: string;
  kind: string;
  source?: string;
  epic?: string;
  severity?: string;
  [key: string]: unknown;
};

export type QueueFile = {
  version: number;
  notes?: string;
  tasks: QueueTask[];
};

export function sourceKey(fingerprint: string): string {
  return `dustmap:${fingerprint}`;
}

export function loadQueueFile(queuePath: string): QueueFile {
  if (!existsSync(queuePath)) {
    return { version: 1, tasks: [] };
  }
  const raw = JSON.parse(readFileSync(queuePath, "utf8")) as QueueFile;
  if (!Array.isArray(raw.tasks)) {
    throw new Error(`Invalid queue file ${queuePath}: tasks must be an array`);
  }
  return {
    version: Number.isInteger(raw.version) ? raw.version : 1,
    ...(typeof raw.notes === "string" ? { notes: raw.notes } : {}),
    tasks: raw.tasks,
  };
}

export function saveQueueFile(queuePath: string, queue: QueueFile): void {
  mkdirSync(path.dirname(queuePath), { recursive: true });
  writeFileSync(queuePath, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
}

export function findBySource(queue: QueueFile, fingerprint: string): QueueTask | undefined {
  const key = sourceKey(fingerprint);
  return queue.tasks.find((t) => t.source === key);
}

/** Next id like PREFIX-01 / PREFIX-13 based on existing numeric suffixes. */
export function nextId(queue: QueueFile, idPrefix: string): string {
  const re = new RegExp(`^${escapeRegExp(idPrefix)}-(\\d+)$`);
  let max = 0;
  for (const t of queue.tasks) {
    const m = t.id.match(re);
    if (m?.[1]) {
      const n = Number.parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  const next = max + 1;
  const width = Math.max(2, String(next).length);
  return `${idPrefix}-${String(next).padStart(width, "0")}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function briefFileName(id: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug.length > 0 ? `${id}-${slug}.md` : `${id}.md`;
}
