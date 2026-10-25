#!/usr/bin/env tsx
/**
 * CON-03 step 3: dump unlabeled batches for a second rater (no first labels),
 * then score agreement once second JSONL files exist.
 *
 *   npx tsx tools/emb/gold/second-opinion.mts dump
 *   npx tsx tools/emb/gold/second-opinion.mts score
 *   npx tsx tools/emb/gold/second-opinion.mts score --resolve   # write resolutions from .tmp/…/resolve.jsonl
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { privatePath } from "../../private-data.mjs";
import { targetDir } from "../../targets/registry.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const outDir = path.join(repo, ".tmp/con03-second");
const refsPath = privatePath("gold", "real-refs.jsonl");
const candPath = path.join(repo, ".tmp/con03/candidates.json");
const BATCH = 28;

type Side = { path: string; startLine: number; endLine: number; name?: string; kind?: string; repo?: string; sha?: string };
type Ref = { id: string; label: string; larger?: string | null; a: Side; b: Side; pairKind?: string };

const cmd = process.argv[2] ?? "dump";

function snapRoot(repoName: string, sha: string): string {
  return path.join(repo, ".tmp/targets", `${repoName}@${sha.slice(0, 12)}`, "src");
}

function readSpan(side: Side): string | null {
  if (!side.repo || !side.sha || !side.path) return null;
  // Prefer live Monorepo-A for CSS (archive often omits .css)
  const live =
    side.repo === "monorepo-a"
      ? targetDir("monorepo-a")
      : targetDir("service-b");
  const candidates = [
    path.join(snapRoot(side.repo, side.sha), side.path),
    path.join(live, side.path),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    return lines.slice(side.startLine - 1, side.endLine).join("\n");
  }
  return null;
}

function loadCode(ref: Ref, cand: Map<string, { codeA: string; codeB: string; pairKind?: string }>) {
  const c = cand.get(ref.id);
  if (c?.codeA && c?.codeB) return { codeA: c.codeA, codeB: c.codeB, pairKind: c.pairKind ?? ref.pairKind };
  const codeA = readSpan(ref.a);
  const codeB = readSpan(ref.b);
  if (!codeA || !codeB) return null;
  return { codeA, codeB, pairKind: ref.pairKind };
}

function dump() {
  mkdirSync(outDir, { recursive: true });
  const refs: Ref[] = readFileSync(refsPath, "utf8")
    .trim()
    .split(/\n/)
    .map((l) => JSON.parse(l));
  const cand = new Map(
    existsSync(candPath)
      ? (JSON.parse(readFileSync(candPath, "utf8")) as Array<{ id: string; codeA: string; codeB: string; pairKind?: string }>).map(
          (c) => [c.id, c],
        )
      : [],
  );

  const packs: unknown[] = [];
  let missing = 0;
  for (const r of refs) {
    const code = loadCode(r, cand);
    if (!code) {
      missing++;
      continue;
    }
    packs.push({
      id: r.id,
      pairKind: code.pairKind ?? "fn-fn",
      a: { name: r.a.name, path: r.a.path, startLine: r.a.startLine, endLine: r.a.endLine, kind: r.a.kind, code: code.codeA },
      b: { name: r.b.name, path: r.b.path, startLine: r.b.startLine, endLine: r.b.endLine, kind: r.b.kind, code: code.codeB },
    });
  }

  // Stable shuffle so re-dumps keep batch membership
  let seed = 20261022;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = packs.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [packs[i], packs[j]] = [packs[j]!, packs[i]!];
  }

  const batchMeta = [];
  for (let i = 0; i < packs.length; i += BATCH) {
    const slice = packs.slice(i, i + BATCH).map((p, idx) => ({ index: i + idx, ...(p as object) }));
    const n = String(Math.floor(i / BATCH)).padStart(2, "0");
    writeFileSync(path.join(outDir, `batch-${n}.json`), JSON.stringify(slice, null, 2));
    batchMeta.push({ n, count: slice.length });
  }
  writeFileSync(path.join(outDir, "RUBRIC.md"), readFileSync(path.join(repo, ".tmp/con03-label/RUBRIC.md"), "utf8"));
  // Hide first labels from second raters (only used by score)
  writeFileSync(
    path.join(outDir, "first-labels.jsonl"),
    refs.map((r) => JSON.stringify({ id: r.id, label: r.label, larger: r.larger ?? null })).join("\n") + "\n",
  );
  console.log(JSON.stringify({ dumped: packs.length, missingCode: missing, batches: batchMeta.length }, null, 2));
}

function cohenKappa(a: string[], b: string[], labels: string[]): number {
  const n = a.length;
  if (n === 0) return 0;
  const idx = new Map(labels.map((l, i) => [l, i]));
  const matrix = labels.map(() => labels.map(() => 0));
  for (let i = 0; i < n; i++) {
    const r = idx.get(a[i]!);
    const c = idx.get(b[i]!);
    if (r === undefined || c === undefined) continue;
    matrix[r]![c]!++;
  }
  let po = 0;
  for (let i = 0; i < labels.length; i++) po += matrix[i]![i]!;
  po /= n;
  const row = labels.map((_, i) => matrix[i]!.reduce((s, x) => s + x, 0) / n);
  const col = labels.map((_, j) => matrix.reduce((s, rowM) => s + rowM[j]!, 0) / n);
  let pe = 0;
  for (let i = 0; i < labels.length; i++) pe += row[i]! * col[i]!;
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

function score() {
  const first = new Map(
    readFileSync(path.join(outDir, "first-labels.jsonl"), "utf8")
      .trim()
      .split(/\n/)
      .map((l) => {
        const o = JSON.parse(l);
        return [o.id as string, o as { id: string; label: string; larger: string | null }];
      }),
  );
  const second = new Map<string, { id: string; label: string; larger: string | null; why?: string }>();
  for (const f of readdirSync(outDir).filter((x) => /^labels-batch-\d+\.jsonl$/.test(x)).sort()) {
    for (const line of readFileSync(path.join(outDir, f), "utf8").trim().split(/\n/).filter(Boolean)) {
      const o = JSON.parse(line);
      second.set(o.id, o);
    }
  }
  const both: Array<{ id: string; first: string; second: string }> = [];
  const disagree: Array<{ id: string; first: string; second: string; firstLarger: string | null; secondLarger: string | null }> = [];
  for (const [id, s] of second) {
    const f = first.get(id);
    if (!f) continue;
    both.push({ id, first: f.label, second: s.label });
    if (f.label !== s.label || (f.label === "contains" && f.larger !== s.larger)) {
      disagree.push({ id, first: f.label, second: s.label, firstLarger: f.larger, secondLarger: s.larger ?? null });
    }
  }
  const labels = ["same", "contains", "concept", "pattern", "different"];
  const agree = both.filter((x) => x.first === x.second).length;
  const kappa = cohenKappa(
    both.map((x) => x.first),
    both.map((x) => x.second),
    labels,
  );
  const byLabel: Record<string, number> = {};
  for (const x of both) {
    const k = `${x.first}→${x.second}`;
    byLabel[k] = (byLabel[k] ?? 0) + 1;
  }
  writeFileSync(path.join(outDir, "disagreements.jsonl"), disagree.map((d) => JSON.stringify(d)).join("\n") + (disagree.length ? "\n" : ""));
  const summary = {
    secondLabeled: second.size,
    compared: both.length,
    agreement: both.length ? agree / both.length : 0,
    kappa,
    disagreements: disagree.length,
    transitions: Object.fromEntries(Object.entries(byLabel).sort((a, b) => b[1] - a[1]).slice(0, 20)),
  };
  writeFileSync(path.join(outDir, "agreement.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));

  if (process.argv.includes("--resolve")) {
    const resolvePath = path.join(outDir, "resolve.jsonl");
    if (!existsSync(resolvePath)) {
      console.error("Missing resolve.jsonl (id + final label/larger/why)");
      process.exit(2);
    }
    const resolutions = new Map(
      readFileSync(resolvePath, "utf8")
        .trim()
        .split(/\n/)
        .filter(Boolean)
        .map((l) => {
          const o = JSON.parse(l);
          return [o.id as string, o];
        }),
    );
    const refs = readFileSync(refsPath, "utf8")
      .trim()
      .split(/\n/)
      .map((l) => JSON.parse(l));
    let applied = 0;
    const out = refs.map((r) => {
      const res = resolutions.get(r.id);
      if (!res) return r;
      applied++;
      // Keep original source tag (CON-01 / CON-03 / EMB-10 …) so isRealSource still matches.
      const next = { ...r, label: res.label, why: res.why ?? r.why };
      if (res.label === "contains") next.larger = res.larger;
      else delete next.larger;
      return next;
    });
    writeFileSync(refsPath, out.map((r) => JSON.stringify(r)).join("\n") + "\n");
    console.log(JSON.stringify({ applied, unresolved: disagree.filter((d) => !resolutions.has(d.id)).length }));
  }
}

if (cmd === "dump") dump();
else if (cmd === "score") score();
else {
  console.error("Usage: second-opinion.mts dump|score [--resolve]");
  process.exit(2);
}
