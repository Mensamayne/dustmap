/**
 * Pure queue validation (shape, gates, cycles). Used by the CLI and by the self-test.
 * Does not touch the filesystem except through the injected `briefExists` callback.
 */
import { STATUSES, KINDS, SEVERITIES } from "./lib.mjs";

/**
 * @param {{ version?: unknown, tasks?: unknown }} queue
 * @param {{ briefExists: (task: { id?: string, brief?: string }) => boolean }} opts
 * @returns {string[]}
 */
export function validateQueue(queue, opts) {
  const errors = [];
  const ids = new Set();

  if (!Number.isInteger(queue.version)) errors.push("version musi być liczbą całkowitą");
  if (!Array.isArray(queue.tasks)) errors.push("tasks musi być tablicą");

  for (const t of queue.tasks ?? []) {
    const where = t.id ?? "(bez id)";
    for (const key of ["id", "title", "segment", "brief"]) {
      if (typeof t[key] !== "string" || !t[key]) errors.push(`${where}: brak pola ${key}`);
    }
    if (!Number.isInteger(t.layer)) errors.push(`${where}: layer musi być liczbą całkowitą`);
    if (!Array.isArray(t.gates)) errors.push(`${where}: gates musi być tablicą`);
    if (!STATUSES.includes(t.status)) errors.push(`${where}: zły status ${t.status}`);
    if (!KINDS.includes(t.kind)) errors.push(`${where}: zły kind ${t.kind}`);
    if (t.kind === "bug" && !SEVERITIES.includes(t.severity)) {
      errors.push(`${where}: bug bez poprawnego severity`);
    }
    if (ids.has(t.id)) errors.push(`${where}: zduplikowane id`);
    ids.add(t.id);
    if (t.brief && !opts.briefExists(t)) errors.push(`${where}: brak pliku briefu ${t.brief}`);
  }

  const byId = new Map((queue.tasks ?? []).map((t) => [t.id, t]));
  for (const t of queue.tasks ?? []) {
    for (const g of t.gates ?? []) {
      if (!byId.has(g)) errors.push(`${t.id}: gate ${g} nie istnieje`);
    }
  }

  const state = new Map();
  function visit(id, trail) {
    if (state.get(id) === "done") return;
    if (state.get(id) === "open") {
      errors.push(`cykl w gates: ${[...trail, id].join(" → ")}`);
      return;
    }
    state.set(id, "open");
    for (const g of byId.get(id)?.gates ?? []) {
      if (byId.has(g)) visit(g, [...trail, id]);
    }
    state.set(id, "done");
  }
  for (const id of byId.keys()) visit(id, []);

  return errors;
}
