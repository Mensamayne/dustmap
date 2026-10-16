/**
 * Persist human/agent decisions under outputDir/decisions.yml (dustmap.decisions/v1).
 * keep / wontfix mute a fingerprint from the report until the finding's fingerprint changes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  Decision,
  DecisionFile,
  type DecisionType,
  type DecisionVerdictType,
  type FindingType,
} from "@dustmap/contract";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export const DECISIONS_FILE = "decisions.yml";

const EMPTY: DecisionFile = {
  schema: "dustmap.decisions/v1",
  decisions: [],
};

export function decisionsPath(outputDir: string): string {
  return path.join(outputDir, DECISIONS_FILE);
}

export function loadDecisions(outputDir: string): DecisionFile {
  const file = decisionsPath(outputDir);
  if (!existsSync(file)) return { ...EMPTY, decisions: [] };
  const raw = readFileSync(file, "utf8");
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new Error(`Invalid decisions.yml (${file}): ${String(err)}`);
  }
  const result = DecisionFile.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid decisions.yml (${file}): ${result.error.message}`);
  }
  return result.data;
}

export function saveDecisions(outputDir: string, file: DecisionFile): string {
  mkdirSync(outputDir, { recursive: true });
  const validated = DecisionFile.parse(file);
  const dest = decisionsPath(outputDir);
  writeFileSync(dest, stringifyYaml(validated, { lineWidth: 100 }), "utf8");
  return dest;
}

/** Upsert one decision by fingerprint. */
export function upsertDecision(outputDir: string, decision: DecisionType): DecisionFile {
  const validated = Decision.parse(decision);
  const current = loadDecisions(outputDir);
  const rest = current.decisions.filter((d) => d.fingerprint !== validated.fingerprint);
  const next: DecisionFile = {
    schema: "dustmap.decisions/v1",
    decisions: [...rest, validated].sort((a, b) => a.fingerprint.localeCompare(b.fingerprint)),
  };
  saveDecisions(outputDir, next);
  return next;
}

const MUTE_VERDICTS = new Set<DecisionVerdictType>(["keep", "wontfix"]);

/** Fingerprints muted by keep / wontfix (fix stays visible). */
export function mutedFingerprints(file: DecisionFile): Set<string> {
  const out = new Set<string>();
  for (const d of file.decisions) {
    if (MUTE_VERDICTS.has(d.verdict)) out.add(d.fingerprint);
  }
  return out;
}

/** Drop muted findings from the list used for ranking and category counts. */
export function applyDecisions(
  findings: readonly FindingType[],
  file: DecisionFile,
): FindingType[] {
  const muted = mutedFingerprints(file);
  if (muted.size === 0) return [...findings];
  return findings.filter((f) => !muted.has(f.fingerprint));
}
