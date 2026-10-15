#!/usr/bin/env node
/**
 * Repo-wide gate: queue validation, then typecheck + tests of every workspace package that defines them.
 * Briefs extend this file when they add gates (e.g. DUST-12 isolation).
 */
import { execSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, cwd = root) => {
  console.log(`> ${cmd}${cwd === root ? "" : `  (${path.relative(root, cwd)})`}`);
  execSync(cmd, { cwd, stdio: "inherit" });
};

run("node tools/queue/validate.mjs");
run("node tools/queue/validate.selftest.mjs");
run("node tools/targets/targets.selftest.mjs");

const pkgRoot = path.join(root, "packages");
const dirs = existsSync(pkgRoot) ? readdirSync(pkgRoot).map((d) => path.join(pkgRoot, d)) : [];
for (const dir of dirs) {
  const manifest = path.join(dir, "package.json");
  if (!existsSync(manifest)) continue;
  const scripts = JSON.parse(readFileSync(manifest, "utf8")).scripts ?? {};
  if (scripts.typecheck) run("npm run typecheck", dir);
  if (scripts.test) run("npm test", dir);
}
console.log(`verify: OK (${dirs.length} paczek)`);
