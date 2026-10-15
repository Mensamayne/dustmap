#!/usr/bin/env node
/**
 * Compare a target's report with its hand-reviewed ground truth.
 *
 *   npm run target:compare -- <name>                      uses ground-truth/<name>.json and the pinned snapshot run
 *   npm run target:compare -- --gt <file> --report <file>  explicit files (self-test)
 *
 * Fails (exit 1) on: a forbidden finding (e.g. a Next page reported dead with high confidence),
 * precision of reviewed high-confidence findings below `minHighPrecision`, a report from another
 * commit than the ground truth pins. Exit 2 = nothing to compare against (run the target first).
 * Findings without a verdict are listed so the next review knows what to look at.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { minimatch } from "minimatch";
import { z } from "zod";
import { Confidence, Report, type ConfidenceType, type FindingType } from "../../packages/contract/src/index.ts";
import { builtinAdapters } from "../../packages/core/src/index.ts";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const GroundTruth = z
  .object({
    target: z.string().min(1),
    sha: z.string().regex(/^[0-9a-f]{40}$/),
    minHighPrecision: z.number().min(0).max(1).optional(),
    entries: z.array(
      z
        .object({
          fingerprint: z.string().regex(/^[a-f0-9]{16}$/),
          verdict: z.enum(["real", "false-positive", "intended-pattern"]),
          why: z.string().min(10),
        })
        .strict(),
    ),
    forbidden: z.array(
      z
        .object({
          glob: z.string().min(1),
          kind: z.string().min(1),
          maxConfidence: Confidence,
          why: z.string().min(10),
        })
        .strict(),
    ),
  })
  .strict();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function fail(code: number, message: string): never {
  console.error(message);
  process.exit(code);
}

const name = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : undefined;
const gtPath = arg("gt") ?? (name ? path.join(repo, "tools/targets/ground-truth", `${name}.json`) : undefined);
if (!gtPath) fail(2, "Użycie: npm run target:compare -- <monorepo-a|service-b>  albo  --gt <plik> --report <plik>");
if (!existsSync(gtPath)) fail(2, `Brak zbioru prawdy: ${gtPath}`);
const gt = GroundTruth.parse(JSON.parse(readFileSync(gtPath, "utf8")));

const runDir = path.join(repo, ".tmp", "targets", `${gt.target}@${gt.sha.slice(0, 12)}`);
const reportPath = arg("report") ?? path.join(runDir, "out", "report.json");
if (!existsSync(reportPath)) {
  if (!arg("report") && builtinAdapters().length === 0 && existsSync(path.join(runDir, "inventory.json"))) {
    console.log(`${gt.target}: brak wykrywaczy, więc brak znalezisk do porównania. Zbiór prawdy: ${gt.entries.length} werdyktów, ${gt.forbidden.length} zakazów.`);
    process.exit(0);
  }
  fail(2, `Brak raportu ${reportPath}. Najpierw: npm run target -- ${gt.target} --snapshot ${gt.sha}`);
}
const report = Report.parse(JSON.parse(readFileSync(reportPath, "utf8")));
if (report.scan.commit !== gt.sha) {
  fail(1, `Raport z commita ${report.scan.commit.slice(0, 12)}, a zbiór prawdy przypina ${gt.sha.slice(0, 12)}. Uruchom migawkę z przypiętego commita.`);
}

const rank: Record<ConfidenceType, number> = { low: 0, medium: 1, high: 2 };
const violations: string[] = [];
for (const f of report.findings) {
  for (const rule of gt.forbidden) {
    if (rule.kind !== "*" && rule.kind !== f.kind) continue;
    if (rank[f.confidence] <= rank[rule.maxConfidence]) continue;
    const loc = f.locations.find((l) => minimatch(l.path, rule.glob, { dot: true }));
    if (loc) violations.push(`${f.kind} (${f.confidence}) w ${loc.path} — zakaz: ${rule.why}`);
  }
}

const verdicts = new Map(gt.entries.map((e) => [e.fingerprint, e.verdict]));
const high = report.findings.filter((f) => f.confidence === "high");
const reviewedHigh = high.filter((f) => verdicts.has(f.fingerprint));
const realHigh = reviewedHigh.filter((f) => verdicts.get(f.fingerprint) === "real").length;
const precision = reviewedHigh.length ? realHigh / reviewedHigh.length : null;
const unreviewed: FindingType[] = report.findings.filter((f) => !verdicts.has(f.fingerprint));

console.log(`${gt.target} @ ${gt.sha.slice(0, 12)}: ${report.findings.length} znalezisk, wysoka pewność ${high.length}.`);
console.log(
  precision === null
    ? "Trafność wysokiej pewności: brak ocenionych znalezisk."
    : `Trafność wysokiej pewności: ${realHigh}/${reviewedHigh.length} = ${(precision * 100).toFixed(0)}%${gt.minHighPrecision !== undefined ? ` (minimum ${(gt.minHighPrecision * 100).toFixed(0)}%)` : ""}.`,
);
console.log(`Bez werdyktu: ${unreviewed.length}.`);
for (const f of unreviewed.slice(0, 10)) {
  console.log(`  ${f.fingerprint} ${f.kind} ${f.confidence} ${f.locations[0]?.path ?? ""}`);
}

let failed = false;
if (violations.length) {
  failed = true;
  console.error(`Naruszenia zakazów (${violations.length}):`);
  for (const v of violations) console.error(`  - ${v}`);
}
if (precision !== null && gt.minHighPrecision !== undefined && precision < gt.minHighPrecision) {
  failed = true;
  console.error(`Trafność spadła poniżej minimum.`);
}
process.exit(failed ? 1 : 0);
