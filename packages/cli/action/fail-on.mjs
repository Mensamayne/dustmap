#!/usr/bin/env node
/**
 * Map action input fail-on (none|new-high|new-any) onto the Dustmap ratchet.
 * Plain Node — reads report.json + baseline.json under outputDir only. Never commits.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const CONFIDENCE_RANK = { low: 1, medium: 2, high: 3 };

function usage() {
  console.error(
    "Usage: node fail-on.mjs --fail-on none|new-high|new-any [--out <dir>] [--cwd <dir>]",
  );
  process.exit(2);
}

function parseArgs(argv) {
  let failOn = "new-high";
  let out;
  let cwd = process.cwd();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fail-on") {
      failOn = argv[++i];
    } else if (a === "--out") {
      out = argv[++i];
    } else if (a === "--cwd") {
      cwd = path.resolve(argv[++i] ?? "");
    } else if (a === "--help" || a === "-h") {
      usage();
    } else {
      console.error(`Unknown arg: ${a}`);
      usage();
    }
  }
  if (!failOn || !["none", "new-high", "new-any"].includes(failOn)) {
    console.error(`Invalid --fail-on: ${failOn}`);
    usage();
  }
  return { failOn, out, cwd };
}

function resolveOutDir(cwd, out) {
  if (out) return path.resolve(cwd, out);
  const configPath = path.join(cwd, "dustmap.config.json");
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf8"));
      if (typeof cfg.outputDir === "string" && cfg.outputDir.length > 0) {
        return path.resolve(cwd, cfg.outputDir);
      }
    } catch {
      /* fall through to default */
    }
  }
  return path.join(cwd, ".dustmap");
}

function loadBaseline(outDir) {
  const file = path.join(outDir, "baseline.json");
  if (!existsSync(file)) return { fingerprints: [] };
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const fps = Array.isArray(raw.fingerprints) ? raw.fingerprints : [];
  return { fingerprints: fps.filter((x) => typeof x === "string") };
}

function meetsFloor(confidence, floor) {
  const c = CONFIDENCE_RANK[confidence] ?? 0;
  const f = CONFIDENCE_RANK[floor] ?? 2;
  return c >= f;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.failOn === "none") {
    console.log("fail-on=none · ratchet skipped");
    process.exit(0);
  }

  const outDir = resolveOutDir(args.cwd, args.out);
  const reportPath = path.join(outDir, "report.json");
  if (!existsSync(reportPath)) {
    console.error(`No report.json under ${outDir}. Run dustmap scan first.`);
    process.exit(2);
  }

  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const baseline = loadBaseline(outDir);
  const known = new Set(baseline.fingerprints);
  const minConfidence = args.failOn === "new-high" ? "high" : "low";

  const newFindings = findings.filter(
    (f) =>
      f &&
      typeof f.fingerprint === "string" &&
      typeof f.confidence === "string" &&
      meetsFloor(f.confidence, minConfidence) &&
      !known.has(f.fingerprint),
  );

  if (newFindings.length === 0) {
    console.log(
      `Ratchet clean · fail-on=${args.failOn} · floor=${minConfidence} · baseline ${known.size}`,
    );
    process.exit(0);
  }

  console.error(
    `Ratchet failed · fail-on=${args.failOn} · ${newFindings.length} new finding(s) ≥ ${minConfidence}`,
  );
  for (const f of newFindings.slice(0, 20)) {
    const loc = f.locations?.[0]?.path ?? "?";
    console.error(`  - ${f.fingerprint} ${f.kind} ${f.confidence} ${loc}`);
  }
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
}
