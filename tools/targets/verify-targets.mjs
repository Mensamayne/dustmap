#!/usr/bin/env node
/**
 * verify:targets — pinned snapshot run + ground-truth comparison for every target with a ground
 * truth file. Not part of the default `verify` (needs the sibling repos); mandatory when closing a
 * brief that changes scan results. A missing target is reported and fails (exit 2) — never green.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { privatePath } from "../private-data.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Ground truths of the private targets live outside git (REL-03); a public clone has none to check.
const gtDir = privatePath("targets", "ground-truth");
const run = (script, args) =>
  spawnSync(process.execPath, [path.join(repo, "node_modules/tsx/dist/cli.mjs"), script, ...args], { cwd: repo, stdio: "inherit" }).status ?? 1;

if (!existsSync(gtDir)) {
  console.log(`verify:targets: no private targets here (${path.relative(repo, gtDir)} missing) — nothing to measure`);
  process.exit(0);
}
let worst = 0;
for (const file of readdirSync(gtDir).filter((f) => f.endsWith(".json")).sort()) {
  const { target, sha } = JSON.parse(readFileSync(path.join(gtDir, file), "utf8"));
  console.log(`\n== ${target} @ ${sha.slice(0, 12)}`);
  const scanned = run("tools/targets/run.mts", [target, "--snapshot", sha]);
  const code = scanned !== 0 ? scanned : run("tools/targets/compare.mts", [target]);
  worst = Math.max(worst, code);
}
console.log(worst === 0 ? "\nverify:targets: OK" : `\nverify:targets: NIE (kod ${worst})`);
process.exit(worst);
