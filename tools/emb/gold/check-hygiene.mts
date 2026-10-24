#!/usr/bin/env tsx
/**
 * CON-10: hygiene gate for private gold refs (real-refs / private-refs).
 * Flags product-out paths, backup/storyboard dumps, trivial one-line `different` locals when both
 * spans can be read from the pinned snapshot, and nested pairs (one span inside the other in the same
 * file — the scan drops them, so they measure nothing a user sees; CON-12).
 *
 *   npx tsx tools/emb/gold/check-hygiene.mts
 *   npx tsx tools/emb/gold/check-hygiene.mts --selftest
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");

type Side = {
  repo?: string;
  sha?: string;
  path?: string;
  startLine?: number;
  endLine?: number;
  code?: string;
};
type Row = { id?: string; label?: string; a?: Side; b?: Side };

const TRIVIAL_LINE =
  /^\s*(?:const|let|var)\s+\w+[^=]*=\s*(?:null|undefined|""|''|0|true|false|\{\}|\[\]|new\s+Set\b[^;]*);?\s*$/;

const OUT_OF_PRODUCT = /\.claude[/\\]skills[/\\]/;
const DUMP_PATH = /[/\\]backups[/\\]|storyboard\.css$/i;

function readSpan(s: Side): string | null {
  if (typeof s.code === "string") return s.code;
  if (!s.repo || !s.sha || !s.path || !s.startLine || !s.endLine) return null;
  const snap = path.join(repo, ".tmp/targets", `${s.repo}@${s.sha.slice(0, 12)}`, "src", s.path);
  if (!existsSync(snap)) return null;
  return readFileSync(snap, "utf8")
    .split(/\r?\n/)
    .slice(s.startLine - 1, s.endLine)
    .join("\n");
}

function sideLines(s: Side, code: string | null): number {
  if (code != null) return code.split(/\r?\n/).filter((l) => l.length > 0 || code.length > 0).length || 1;
  if (s.startLine != null && s.endLine != null) return Math.max(0, s.endLine - s.startLine + 1);
  return 0;
}

/** → list of problem strings (empty = clean). */
export function checkHygiene(rows: Row[]): string[] {
  const bad: string[] = [];
  const ids = new Set<string>();
  for (const r of rows) {
    const at = r.id ?? "?";
    if (typeof r.id === "string" && r.id) {
      if (ids.has(r.id)) bad.push(`${at}: zdublowane id (higiena)`);
      ids.add(r.id);
    }
    for (const side of [r.a, r.b] as const) {
      const p = side?.path ?? "";
      if (OUT_OF_PRODUCT.test(p)) bad.push(`${at}: ścieżka poza produktem (.claude/skills): ${p}`);
      if (DUMP_PATH.test(p)) bad.push(`${at}: dump backup/storyboard: ${p}`);
    }
    if (r.a && r.b && r.a.path === r.b.path && r.a.startLine != null && r.a.endLine != null && r.b.startLine != null && r.b.endLine != null) {
      const inside = (x: Side, y: Side) => x.startLine! >= y.startLine! && x.endLine! <= y.endLine!;
      if (inside(r.a, r.b) || inside(r.b, r.a)) bad.push(`${at}: para zagnieżdżona (jedna strona w środku drugiej) — skan takich nie zgłasza`);
    }
    if (r.label === "different" && r.a && r.b) {
      const ca = readSpan(r.a);
      const cb = readSpan(r.b);
      // Only when both sides are readable (selftest plants `code`; live gold needs snapshots).
      if (ca != null && cb != null) {
        const a1 = sideLines(r.a, ca) <= 1;
        const b1 = sideLines(r.b, cb) <= 1;
        if (a1 && b1 && TRIVIAL_LINE.test(ca.trim()) && TRIVIAL_LINE.test(cb.trim())) {
          bad.push(`${at}: trywialne lokale jako different`);
        }
      }
    }
  }
  return bad;
}

function loadPrivateRows(): Row[] {
  return ["private-refs.jsonl", "real-refs.jsonl"]
    .map((f) => path.join(here, f))
    .filter((f) => existsSync(f))
    .flatMap((f) =>
      readFileSync(f, "utf8")
        .trim()
        .split(/\n/)
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Row),
    );
}

function selftest() {
  const base: Row = {
    id: "hygiene-base",
    label: "different",
    a: { repo: "x", sha: "0".repeat(40), path: "ok/a.ts", startLine: 1, endLine: 3, code: "function a() {\n  return 1;\n}" },
    b: { repo: "x", sha: "0".repeat(40), path: "ok/b.ts", startLine: 1, endLine: 3, code: "function b() {\n  return 2;\n}" },
  };
  const planted: Array<[string, Row[]]> = [
    [
      "ścieżka .claude/skills",
      [{ ...base, id: "h1", a: { ...base.a!, path: ".claude/skills/x/check.js", code: "const x = 1;" } }],
    ],
    [
      "dump storyboard.css",
      [{ ...base, id: "h2", b: { ...base.b!, path: "assets/backups/old/preview/storyboard.css", code: "*{}" } }],
    ],
    [
      "trywialne lokale different",
      [
        {
          ...base,
          id: "h3",
          label: "different",
          a: { ...base.a!, path: "a.ts", startLine: 1, endLine: 1, code: "const seen = new Set<string>();" },
          b: { ...base.b!, path: "b.ts", startLine: 1, endLine: 1, code: "let failed = 0;" },
        },
      ],
    ],
    [
      "para zagnieżdżona",
      [{ ...base, id: "h4", b: { ...base.a!, startLine: 2, endLine: 2, code: "  return 1;" } }],
    ],
    [
      "zdublowane id",
      [
        { ...base, id: "dup" },
        { ...base, id: "dup" },
      ],
    ],
  ];
  let failed = 0;
  for (const [what, rows] of planted) {
    const caught = checkHygiene(rows).length > 0;
    console.log(`${caught ? "PASS" : "FAIL"}: ${what} → higiena czerwona`);
    if (!caught) failed++;
  }
  const clean = checkHygiene([base]);
  if (clean.length) {
    console.log("FAIL: czysta para nie powinna czerwienić");
    failed++;
  } else {
    console.log("PASS: czysta para → higiena zielona");
  }
  console.log(failed ? `gold hygiene selftest: ${failed} FAIL` : "gold hygiene selftest: OK");
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--selftest")) selftest();
  const bad = checkHygiene(loadPrivateRows());
  if (bad.length) {
    for (const b of bad) console.error(`  - ${b}`);
    process.exit(1);
  }
  console.log("gold hygiene: OK");
}
