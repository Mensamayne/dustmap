#!/usr/bin/env node
/**
 * Self-test for target tooling (DUST-16). Proves, on a throwaway git repo:
 *   - live and snapshot runs never write inside the target (file list + `git status` identical),
 *   - a missing target exits 2 (never a fake green),
 *   - compare goes red on a forbidden finding, on low precision, and on a report from another commit,
 *     and stays green on a clean report.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tsx = path.join(repo, "node_modules/tsx/dist/cli.mjs");
const tsxRun = (script, args) =>
  spawnSync(process.execPath, [tsx, path.join(repo, script), ...args], { cwd: repo, encoding: "utf8" });
const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}: ${name}${ok ? "" : ` ${detail}`}`);
  if (!ok) failures++;
}

function listTree(root) {
  const out = [];
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === ".git") continue;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(abs);
      else out.push(path.relative(root, abs));
    }
  };
  walk(root);
  return out.sort().join("\n");
}

// Throwaway target.
const target = mkdtempSync(path.join(tmpdir(), "dustmap-target-"));
const write = (rel, text) => {
  mkdirSync(path.dirname(path.join(target, rel)), { recursive: true });
  writeFileSync(path.join(target, rel), text);
};
write("package.json", JSON.stringify({ name: "t", dependencies: { next: "16.0.0" } }));
write("app/page.tsx", "export default function P() { return null; }\n");
write("src/a.ts", "export const a = 1;\n");
write("src/a.test.ts", "import { a } from './a';\n");
git(target, ["init", "-q"]);
git(target, ["-c", "user.email=t@t", "-c", "user.name=t", "add", "."]);
git(target, ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "init"]);
write("src/new.ts", "export const n = 2;\n"); // uncommitted change the runner must not touch
const sha = git(target, ["rev-parse", "HEAD"]);
const before = { tree: listTree(target), status: git(target, ["status", "--porcelain"]) };

const label = `selftest-${process.pid}`;
const live = tsxRun("tools/targets/run.mts", ["--path", target, "--label", label]);
check("live run exits 0", live.status === 0, live.stderr);
check("live run counts 4 files", /Pliki: 4 · kod 3 · testy 1/.test(live.stdout), live.stdout);
const snap = tsxRun("tools/targets/run.mts", ["--path", target, "--label", label, "--snapshot", sha]);
check("snapshot run exits 0", snap.status === 0, snap.stderr);
check("snapshot excludes the uncommitted file", /Pliki: 3 · kod 2 · testy 1/.test(snap.stdout), snap.stdout);
const after = { tree: listTree(target), status: git(target, ["status", "--porcelain"]) };
check("target files unchanged", before.tree === after.tree, `\n${before.tree}\n---\n${after.tree}`);
check("target git status unchanged", before.status === after.status);
check("no .dustmap inside target", !existsSync(path.join(target, ".dustmap")));

const missing = tsxRun("tools/targets/run.mts", ["--path", path.join(target, "does-not-exist")]);
check("missing target exits 2", missing.status === 2, String(missing.status));

// compare gate.
const work = mkdtempSync(path.join(tmpdir(), "dustmap-compare-"));
const fp = (n) => n.toString(16).padStart(16, "0");
const finding = (n, kind, file, confidence) => ({
  fingerprint: fp(n),
  kind,
  category: "dead-code",
  locations: [{ path: file, startLine: 1 }],
  evidence: [{ label: "importers", value: "0" }],
  confidence,
  suggestedAction: "review",
  verifyHint: "Remove and run typecheck.",
  source: "selftest",
});
const report = (commit, findings) => ({
  schema: "dustmap.report/v1",
  scan: { mode: "full", commit, startedAt: new Date().toISOString(), tools: [{ name: "selftest", version: "1" }] },
  summary: { byCategory: { "dead-code": findings.length, duplicate: 0, "semantic-duplicate": 0, "refactor-signal": 0, structure: 0 }, topPlaces: [] },
  findings,
});
const gt = {
  target: "selftest",
  sha,
  minHighPrecision: 0.5,
  entries: [
    { fingerprint: fp(1), verdict: "real", why: "really unused helper" },
    { fingerprint: fp(2), verdict: "false-positive", why: "loaded by the framework" },
    { fingerprint: fp(3), verdict: "false-positive", why: "loaded by name from config" },
  ],
  forbidden: [{ glob: "**/app/**/page.tsx", kind: "unused-file", maxConfidence: "low", why: "framework entry point" }],
};
writeFileSync(path.join(work, "gt.json"), JSON.stringify(gt));
const compare = (name, findings, commit = sha) => {
  const file = path.join(work, `${name}.json`);
  writeFileSync(file, JSON.stringify(report(commit, findings)));
  return tsxRun("tools/targets/compare.mts", ["--gt", path.join(work, "gt.json"), "--report", file]).status;
};
check("compare green on clean report", compare("clean", [finding(1, "unused-export", "src/a.ts", "high"), finding(2, "unused-export", "src/b.ts", "medium")]) === 0);
check("compare red on forbidden finding", compare("forbidden", [finding(9, "unused-file", "app/page.tsx", "high")]) === 1);
check("compare red on low precision", compare("precision", [finding(1, "unused-export", "src/a.ts", "high"), finding(2, "unused-export", "src/b.ts", "high"), finding(3, "unused-export", "src/c.ts", "high")]) === 1);
check("compare red on report from another commit", compare("stale", [], "0".repeat(40)) === 1);

rmSync(path.join(repo, ".tmp", "targets", label), { recursive: true, force: true });
rmSync(path.join(repo, ".tmp", "targets", `${label}@${sha.slice(0, 12)}`), { recursive: true, force: true });
rmSync(target, { recursive: true, force: true });
rmSync(work, { recursive: true, force: true });

if (failures) {
  console.error(`targets.selftest: ${failures} FAIL`);
  process.exit(1);
}
console.log("targets.selftest: OK");
