#!/usr/bin/env node
/**
 * Turn private-spec.json (path + symbol hints from DUST-15) into private-refs.jsonl: exact
 * {repo, sha, path, startLine, endLine} per side, found in the TypeScript AST of the pinned snapshot
 * (.tmp/targets/<target>@<sha12>/src, created by `npm run target -- <target> --snapshot <sha>`).
 * Writes no code — only references and a sha256 of each side, so the meter can detect drift.
 * Ambiguous or missing symbols are reported and left out, never guessed.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { privatePath } from "../../private-data.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const ts = createRequire(path.join(repo, "packages/core/package.json"))("typescript");
const spec = JSON.parse(readFileSync(privatePath("gold", "private-spec.json"), "utf8"));
const snapshot = path.join(repo, ".tmp/targets", `${spec.target}@${spec.sha.slice(0, 12)}`, "src");
if (!existsSync(snapshot)) {
  console.error(`Brak migawki ${snapshot}. Najpierw: npm run target -- ${spec.target} --snapshot ${spec.sha}`);
  process.exit(2);
}

const SKIP = new Set(["node_modules", ".git", "dist", ".next"]);
function walk(rel, out = []) {
  for (const e of readdirSync(path.join(snapshot, rel), { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(child, out);
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) out.push(child);
  }
  return out;
}

function nameOf(node) {
  const n = node.name;
  return n && (ts.isIdentifier(n) || ts.isStringLiteral(n)) ? n.text : undefined;
}

const DECL = (node) =>
  ts.isFunctionDeclaration(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isPropertyAssignment(node) ||
  ts.isPropertyDeclaration(node) ||
  ts.isVariableDeclaration(node);

/**
 * How the lines stand on their own: a top-level function / variable is valid code as is; a class
 * member or an object property needs a wrapper before a parser will accept it (the meter adds it).
 */
function kindOf(node) {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isVariableDeclaration(node)) return "variable";
  if (ts.isPropertyAssignment(node)) return "object-property";
  return "class-member";
}

/** Every declaration of `symbol` in one file → [{startLine, endLine, text}]. */
function declarationsIn(file, symbol) {
  const text = readFileSync(path.join(snapshot, file), "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hits = [];
  const visit = (node) => {
    if (DECL(node) && nameOf(node) === symbol) {
      const start = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const end = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      hits.push({ startLine: start, endLine: end, kind: kindOf(node) });
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

let all;
function candidates(side) {
  if (side.file) return [side.file];
  all ??= walk("");
  if (side.fileLike) return all.filter((f) => f.startsWith(side.fileLike) && /^[.\w-]*\.tsx?$/.test(f.slice(side.fileLike.length)));
  return all.filter((f) => f.startsWith(`${side.under}/`) && readFileSync(path.join(snapshot, f), "utf8").includes(side.symbol));
}

function resolveSide(side) {
  const files = candidates(side).filter((f) => existsSync(path.join(snapshot, f)));
  const hits = files.flatMap((f) => declarationsIn(f, side.symbol).map((h) => ({ path: f, ...h })));
  if (hits.length !== 1) {
    return { error: hits.length === 0 ? "nie znaleziono" : `niejednoznaczne (${hits.map((h) => `${h.path}:${h.startLine}`).join(", ")})` };
  }
  const h = hits[0];
  // Hash exactly what the meter reads back: the whole lines startLine..endLine.
  const span = readFileSync(path.join(snapshot, h.path), "utf8").split(/\r?\n/).slice(h.startLine - 1, h.endLine).join("\n");
  return {
    ref: {
      repo: spec.target,
      sha: spec.sha,
      path: h.path,
      startLine: h.startLine,
      endLine: h.endLine,
      name: side.symbol,
      kind: h.kind,
      sha256: createHash("sha256").update(span).digest("hex"),
    },
  };
}

const split = (id) => (createHash("sha1").update(id).digest()[0] % 3 === 0 ? "validation" : "test");
const lines = [];
const problems = [];
for (const p of spec.pairs) {
  const a = resolveSide(p.a);
  const b = resolveSide(p.b);
  if (a.error || b.error) {
    problems.push(`${p.id}: ${a.error ? `A ${p.a.symbol} — ${a.error}` : ""}${a.error && b.error ? "; " : ""}${b.error ? `B ${p.b.symbol} — ${b.error}` : ""}`);
    continue;
  }
  lines.push(JSON.stringify({ id: p.id, label: p.label, split: split(p.id), source: "DUST-15", sim: p.sim, why: p.why, a: a.ref, b: b.ref }));
}
writeFileSync(privatePath("gold", "private-refs.jsonl"), `${lines.join("\n")}\n`);
console.log(`private-refs.jsonl: ${lines.length}/${spec.pairs.length} par`);
for (const p of problems) console.log(`  pominięte ${p}`);
