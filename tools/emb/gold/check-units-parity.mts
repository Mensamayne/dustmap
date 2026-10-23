#!/usr/bin/env tsx
/**
 * CON-02: on a pinned snapshot, function units from extractUnits must match extractFunctions
 * (same count, lines, content hashes). Training size filters are applied only in dustmap-emb.
 *
 *   npx tsx tools/emb/gold/check-units-parity.mts
 *   npx tsx tools/emb/gold/check-units-parity.mts --root .tmp/targets/monorepo-a@dbe35aa00cd6/src
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { extractFunctions } from "../../../packages/core/src/semantic/extract.ts";
import { extractUnits } from "../../../packages/core/src/semantic/units.ts";
import { repo } from "../gold-data.mts";

const rootArg = process.argv.includes("--root") ? process.argv[process.argv.indexOf("--root") + 1] : null;
const root = path.resolve(repo, rootArg ?? ".tmp/targets/monorepo-a@dbe35aa00cd6/src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".git" || name === "dist") continue;
      out.push(...walk(p));
    } else if (/\.(?:[cm]?[jt]s|[jt]sx)$/i.test(name)) out.push(p);
  }
  return out;
}

let files = 0;
let units = 0;
let mismatches = 0;
for (const file of walk(root)) {
  files++;
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const text = readFileSync(file, "utf8");
  const a = extractFunctions(rel, text, 1);
  const b = extractUnits(rel, text, {
    minTokens: 1,
    includeFunctions: true,
    includeFragments: false,
    includeClasses: false,
    includeCss: false,
  }).filter((u) => u.kind === "function");
  units += a.length;
  if (a.length !== b.length) {
    mismatches++;
    console.error(`count ${rel}: extractFunctions=${a.length} extractUnits=${b.length}`);
    continue;
  }
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.name !== y.name || x.startLine !== y.startLine || x.endLine !== y.endLine || x.contentHash !== y.contentHash) {
      mismatches++;
      console.error(`diff ${rel}: ${x.name}@${x.startLine} vs ${y.name}@${y.startLine}`);
      break;
    }
  }
}

console.log(`parity: files=${files} functions=${units} mismatches=${mismatches} root=${root}`);
process.exit(mismatches ? 1 : 0);
