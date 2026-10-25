#!/usr/bin/env node
/**
 * Public history (REL-05): a fresh clone of this repo whose whole history is rewritten by
 * `git filter-repo` so no commit names the maintainer's private projects or shows their code — files of
 * private research data are dropped from every commit, and every blob and commit message goes through
 * the private alias rules (`private/release-aliases.json`), the private identifiers and path fragments
 * (`private/release-history-terms.json` → ‹private›) and the pair-table rule of old research notes.
 * The local repo is never touched; nothing is pushed. Afterwards it checks every blob and message of the
 * rewritten history and that the final tree is byte-identical to this repo's HEAD tree.
 *
 *   node tools/release/public-history.mjs --out <empty dir> [--filter-repo <git-filter-repo executable>]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { privatePath, repoRoot } from "../private-data.mjs";
import { loadAliasRules } from "./apply-aliases.mjs";

/** Private research data: dropped from every commit (it lives in private/ now, REL-03). */
export const DROPPED_PATHS = [
  "tools/emb/gold/real-refs.jsonl",
  "tools/emb/gold/private-refs.jsonl",
  "tools/emb/gold/private-spec.json",
  "tools/emb/gold/same-file-siblings-*.jsonl",
  "tools/targets/*.dustmap.config.json",
  "tools/targets/ground-truth/*",
];
const MASK = "‹private›";
/** Old research notes listed private code in pair tables (`| # | similarity | pair | …`): the pair cell goes. */
const PAIR_TABLE_RULE = "regex:(?m)^(\\| *\\d+ *\\| *0\\.\\d+ *\\| )[^|\\n]+\\|==>\\1(prywatny kod) |";

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

function loadTerms() {
  const file = privatePath("release-history-terms.json");
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).terms : [];
}

/** filter-repo expression lines: alias rules (regex), the pair-table rule, then each term raw and aliased. */
export function expressions(aliasFile = privatePath("release-aliases.json"), terms = loadTerms()) {
  const { rules } = JSON.parse(readFileSync(aliasFile, "utf8"));
  const aliases = loadAliasRules(aliasFile);
  const lines = rules.map(([from, to, flags]) => `regex:${flags.includes("i") ? "(?i)" : ""}${from}==>${to}`);
  lines.push(PAIR_TABLE_RULE);
  const aliased = (t) => aliases.reduce((s, r) => s.replace(r.re, r.to), t);
  for (const t of [...new Set(terms.flatMap((t) => [t, aliased(t)]))].sort((a, b) => b.length - a.length)) lines.push(`${t}==>${MASK}`);
  return lines;
}

const git = (cwd, args, opts = {}) => execFileSync("git", args, { cwd, maxBuffer: 2 ** 31, ...opts });

/** Every blob of every commit and every commit message, checked against the names and the terms. */
export function audit(repo, { aliasFile = privatePath("release-aliases.json"), terms = loadTerms() } = {}) {
  const names = JSON.parse(readFileSync(aliasFile, "utf8")).rules.map(([from, , flags]) => new RegExp(from, flags));
  const problems = [];
  const objects = git(repo, ["rev-list", "--all", "--objects"]).toString().trim().split("\n");
  const blobs = git(repo, ["cat-file", "--batch-check=%(objecttype) %(objectname)"], { input: objects.map((l) => l.split(" ")[0]).join("\n") })
    .toString()
    .trim()
    .split("\n")
    .filter((l) => l.startsWith("blob "))
    .map((l) => l.slice(5));
  const pathOf = new Map(objects.map((l) => [l.slice(0, 40), l.slice(41)]));
  for (const sha of blobs) {
    const text = git(repo, ["cat-file", "blob", sha]).toString("utf8");
    const where = pathOf.get(sha) || sha;
    for (const re of names) if (re.test(text)) problems.push(`${where}: names ${re.source}`);
    for (const t of terms) if (text.includes(t)) problems.push(`${where}: term ${t}`);
  }
  const messages = git(repo, ["log", "--all", "--format=%H%n%B%n\u0000"]).toString();
  for (const re of names) if (re.test(messages)) problems.push(`commit messages: names ${re.source}`);
  for (const t of terms) if (messages.includes(t)) problems.push(`commit messages: term ${t}`);
  const files = git(repo, ["log", "--all", "--name-only", "--format="]).toString().split("\n");
  const dropped = DROPPED_PATHS.map((g) => new RegExp(`^${g.replace(/[.]/g, "\\.").replace(/\*/g, "[^/]*")}$`));
  for (const f of new Set(files)) if (dropped.some((re) => re.test(f))) problems.push(`dropped path still in history: ${f}`);
  return { problems, blobs: blobs.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")) {
  const out = opt("out");
  const filterRepo = opt("filter-repo") ?? "git-filter-repo";
  if (!out) {
    console.error("Usage: node tools/release/public-history.mjs --out <empty dir> [--filter-repo <exe>]");
    process.exit(2);
  }
  if (!existsSync(privatePath("release-aliases.json"))) {
    console.error(`No alias rules at ${privatePath("release-aliases.json")} — nothing to scrub with; stopping.`);
    process.exit(2);
  }
  const dest = path.resolve(out);
  if (existsSync(dest) && readdirSync(dest).length > 0) {
    console.error(`${dest} is not empty — give a new directory.`);
    process.exit(2);
  }
  git(repoRoot, ["clone", "--quiet", "--no-local", repoRoot, dest]);
  const before = Number(git(dest, ["rev-list", "--count", "HEAD"]).toString().trim());
  const work = mkdtempSync(path.join(tmpdir(), "dustmap-release-"));
  const exprFile = path.join(work, "expressions.txt");
  writeFileSync(exprFile, `${expressions().join("\n")}\n`);
  const args = ["--force", "--invert-paths", ...DROPPED_PATHS.flatMap((g) => ["--path-glob", g]), "--replace-text", exprFile, "--replace-message", exprFile];
  execFileSync(filterRepo, args, { cwd: dest, stdio: "inherit" });
  const after = Number(git(dest, ["rev-list", "--count", "HEAD"]).toString().trim());
  const { problems, blobs } = audit(dest);
  const sourceTree = git(repoRoot, ["rev-parse", "HEAD^{tree}"]).toString().trim();
  const publicTree = git(dest, ["rev-parse", "HEAD^{tree}"]).toString().trim();
  console.log(`commits ${before} → ${after} · blobs checked ${blobs} · final tree ${publicTree === sourceTree ? "identical to this repo's HEAD" : `DIFFERS (${publicTree} vs ${sourceTree})`}`);
  if (publicTree !== sourceTree) problems.push("final tree differs from this repo's HEAD tree");
  for (const p of problems.slice(0, 50)) console.log(`  - ${p}`);
  console.log(problems.length ? `public history: ${problems.length} problem(s)` : `public history: clean — ready to push from ${dest}`);
  process.exit(problems.length ? 1 : 0);
}
