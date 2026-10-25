#!/usr/bin/env node
/**
 * Public-release scrub (REL-03): rewrites tracked text files with the maintainer's private alias rules
 * (`private/release-aliases.json`: real project name → public alias, regex, applied in order), so the
 * public tree never names private projects. The rules file stays outside git; without it this does
 * nothing. `--check` only lists files that still match (exit 1 when any does); REL-05 turns the same
 * rules into `git filter-repo --replace-text` for the history.
 *
 *   node tools/release/apply-aliases.mjs [--check] [--rules <file>]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const argv = process.argv.slice(2);
const at = argv.indexOf("--rules");
const rulesFile = at >= 0 ? path.resolve(argv[at + 1]) : path.join(repo, "private", "release-aliases.json");
const check = argv.includes("--check");

export function loadAliasRules(file = rulesFile) {
  if (!existsSync(file)) return [];
  const { rules } = JSON.parse(readFileSync(file, "utf8"));
  return rules.map(([from, to, flags]) => ({ re: new RegExp(from, `g${flags}`), to }));
}

export function applyAliases(text, rules) {
  return rules.reduce((t, r) => t.replace(r.re, r.to), text);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rules = loadAliasRules();
  if (rules.length === 0) {
    console.log(`apply-aliases: no rules (${path.relative(repo, rulesFile)} missing) — nothing to do`);
    process.exit(0);
  }
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: repo }).toString().split("\0").filter(Boolean);
  const hit = [];
  for (const rel of files) {
    const abs = path.join(repo, rel);
    if (!existsSync(abs)) continue;
    const buf = readFileSync(abs);
    if (buf.includes(0)) continue; // binary
    const text = buf.toString("utf8");
    const next = applyAliases(text, rules);
    if (next === text) continue;
    hit.push(rel);
    if (!check) writeFileSync(abs, next);
  }
  console.log(`${check ? "still naming private projects" : "rewritten"}: ${hit.length}${hit.length ? `\n  ${hit.join("\n  ")}` : ""}`);
  if (check && hit.length) process.exit(1);
}
