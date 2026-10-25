/**
 * The pair judge on the text duplicate layers (V1-02): copies identical up to their constants (L1 shape,
 * `exact-clone` medium) and near copies (L2, `near-clone`). Text alone cannot tell one job copied from
 * one skeleton filled with other data, so after the layers merge the scan's judge reads the lead place
 * against each other place (at most MAX_GROUP_PAIRS), the units cut exactly as the semantic layer cuts
 * them (parsed unit, comments stripped, LF line ends) so a pair both layers read is judged once. Every
 * pair the same job → high. A no never lowers: the text relation is certain, and the judge's no misses
 * one real duplicate in five here (gold, DUP-08: 32 of 40 kept) — the semantic layer, whose relation is
 * only a similarity, is where a no demotes. The group carries the judge's structured `judgement` either
 * way; a pair the judge did not read (budget spent, unit not found) does not count.
 */
import type { Evidence, FindingType } from "@dustmap/contract";
import { groupJudgement, type JudgedPair, type OpenedJudge } from "../judge/judge.js";
import { extractUnits, type CodeUnit } from "../semantic/units.js";

/** Pairs read per group: the lead against this many other places. */
export const MAX_GROUP_PAIRS = 8;

type Place = FindingType["locations"][number];

/** A finding the text layers made and the judge has not read yet. */
export function readsTextJudge(f: FindingType): boolean {
  if (f.judgement) return false;
  return (f.kind === "exact-clone" && f.confidence === "medium") || f.kind === "near-clone";
}

export async function judgeTextDuplicates(
  findings: readonly FindingType[],
  opened: OpenedJudge,
  readFile: (rel: string) => Promise<string>,
): Promise<FindingType[]> {
  const targets = findings.filter(readsTextJudge);
  if (targets.length === 0) return [...findings];
  const judge = opened.judge;
  if (!judge) {
    if (!opened.note) return [...findings];
    const note: Evidence = { label: "judge", value: `not judged — ${opened.note}; text similarity only` };
    return findings.map((f) => (readsTextJudge(f) ? withJudgeEvidence(f, note) : f));
  }

  const units = new Map<string, Promise<CodeUnit[]>>();
  const unitsOf = (file: string) => {
    let hit = units.get(file);
    if (!hit) {
      hit = readFile(file).then(
        (source) => extractUnits(file, source, { minTokens: 0, includeFragments: false, includeCss: false }),
        () => [],
      );
      units.set(file, hit);
    }
    return hit;
  };
  const bodyAt = async (p: Place): Promise<string | null> => {
    const all = await unitsOf(p.path);
    const unit =
      all.find((u) => u.startLine === p.startLine && u.endLine === p.endLine) ??
      all.find((u) => u.startLine === p.startLine && u.name === p.symbol);
    return unit?.body ?? null;
  };

  // Every pair of every group first, then one call: a judge reads a batch faster than single pairs.
  const plans = new Map<FindingType, Array<{ k: number } | null>>();
  const batch: Array<readonly [string, string]> = [];
  for (const f of targets) {
    const lead = await bodyAt(f.locations[0]!);
    const plan: Array<{ k: number } | null> = [];
    for (const other of f.locations.slice(1, MAX_GROUP_PAIRS + 1)) {
      const body = lead === null ? null : await bodyAt(other);
      if (lead === null || body === null) {
        plan.push(null);
        continue;
      }
      plan.push({ k: batch.length });
      batch.push([lead, body]);
    }
    plans.set(f, plan);
  }
  const verdicts = batch.length > 0 ? await judge.judge(batch) : [];

  return findings.map((f) => {
    const plan = plans.get(f);
    if (!plan) return f;
    const read = plan.map((p) => (p ? verdicts[p.k] : null)).filter((v): v is JudgedPair => v != null);
    const sampled = f.locations.length - 1 > MAX_GROUP_PAIRS ? ` (the lead against the first ${MAX_GROUP_PAIRS} of ${f.locations.length - 1} other places)` : "";
    if (read.length === 0) {
      const why = plan.some((p) => p !== null) ? "the judge's pair budget was spent" : "its units could not be cut from the files";
      return withJudgeEvidence(f, { label: "judge", value: `not judged — ${why}; text similarity only` });
    }
    const yes = read.filter((v) => v.score >= judge.threshold).length;
    const scores = read.map((v) => v.score);
    const range = `probability ${Math.min(...scores).toFixed(2)}–${Math.max(...scores).toFixed(2)}, threshold ${judge.threshold}`;
    const counted = `${judge.id}: ${yes} of ${read.length} pairs read as the same job${sampled} (${range})`;
    const judgement = groupJudgement(judge.id, judge.threshold, read);
    if (yes === read.length) {
      return { ...withJudgeEvidence(f, { label: "judge", value: `${counted} — confirmed, ${f.confidence} raised to high` }), confidence: "high", judgement };
    }
    if (yes === 0) {
      return {
        ...withJudgeEvidence(f, { label: "judge", value: `${counted} — reads as a shared pattern or different work; the copy itself is certain, so ${f.confidence} stays` }),
        judgement,
      };
    }
    return { ...withJudgeEvidence(f, { label: "judge", value: `${counted} — split; confidence unchanged` }), judgement };
  });
}

/** The group's own judge line replaces one a merged layer carried for the same places. */
function withJudgeEvidence(f: FindingType, e: Evidence): FindingType {
  return { ...f, evidence: [...f.evidence.filter((x) => x.label !== "judge"), e] };
}
