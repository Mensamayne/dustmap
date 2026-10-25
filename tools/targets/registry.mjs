/**
 * Test-target registry (REL-03): the public targets of tools/targets/targets.json plus the maintainer's
 * private ones (private/targets/targets.json), when present. A target is a repo path (relative to this
 * repo, overridable by its env var) and an optional Dustmap config.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { privatePath, repoRoot } from "../private-data.mjs";

const read = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).targets : {});

export function loadTargets() {
  return { ...read(path.join(repoRoot, "tools/targets/targets.json")), ...read(privatePath("targets", "targets.json")) };
}

/** A target's working tree: its env var when set, else its registry path. */
export function targetDir(name, targets = loadTargets()) {
  const t = targets[name];
  if (!t) throw new Error(`No target "${name}". Known: ${Object.keys(targets).join(", ") || "(none)"}`);
  return path.resolve(repoRoot, process.env[t.env] ?? t.path);
}
