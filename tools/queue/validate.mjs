#!/usr/bin/env node
/**
 * Validate docs/briefs/queue.json: shape (mirrors queue.schema.json), unique ids,
 * existing gates and brief files, no gate cycles, bug severity.
 */
import { loadQueue, briefExists } from "./lib.mjs";
import { validateQueue } from "./validate-core.mjs";

const queue = loadQueue();
const errors = validateQueue(queue, { briefExists });

if (errors.length) {
  console.error(`Kolejka ma błędy (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`OK: ${queue.tasks.length} zadań, kolejka poprawna.`);
