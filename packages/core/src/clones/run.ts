/**
 * Layer L1 of duplicate detection (DUP-01): duplicates certain by construction, no model.
 *   exact-clone   — functions / classes identical once their local names are renamed (high), or once
 *                   their literals are too (medium); evidence: the rename map and the changed literals.
 *   css-duplicate — CSS rules whose whole declaration sets are equivalent (types I–III, high), and
 *                   declaration sets of ≥ N property families shared by rules of one stylesheet
 *                   (medium: grouping them needs the order check of DUP-05).
 * A group whose every member lies inside a member of a larger group is dropped (a helper copied
 * together with its outer function is one finding, not two).
 */
import { fingerprint, type FindingType } from "@dustmap/contract";
import type { AdapterContext } from "../adapter.js";
import { cssRules, duplicationTypes, familyOf, ruleKey, type CssRule } from "./normalize-css.js";
import { literalChanges, normalizedUnits, renameMap, type NormalizedUnit } from "./normalize-ts.js";

const SOURCE = "normalized";
const MAX_RULES_FOR_SHARED_SETS = 1500;

const byLocation = <T extends { path: string; startLine: number }>(a: T, b: T) => a.path.localeCompare(b.path) || a.startLine - b.startLine;
const inside = (x: { path: string; startLine: number; endLine: number }, y: { path: string; startLine: number; endLine: number }) =>
  x.path === y.path && x.startLine >= y.startLine && x.endLine <= y.endLine && (x.startLine !== y.startLine || x.endLine !== y.endLine);

function groupBy<T>(items: readonly T[], key: (t: T) => string): T[][] {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    map.set(k, [...(map.get(k) ?? []), it]);
  }
  return [...map.values()].filter((g) => g.length >= 2);
}

/** Groups not entirely nested inside the members of another group; members nested in a fellow member dropped. */
function outermost<T extends { path: string; startLine: number; endLine: number }>(groups: T[][]): T[][] {
  const pruned = groups.map((g) => g.filter((m) => !g.some((o) => o !== m && inside(m, o)))).filter((g) => g.length >= 2);
  return pruned.filter((g) => !pruned.some((h) => h !== g && g.every((m) => h.some((o) => inside(m, o)))));
}

function cloneFinding(members: NormalizedUnit[], level: "exact" | "shape"): FindingType {
  const sorted = [...members].sort(byLocation);
  const ref = sorted[0]!;
  const renames = sorted
    .slice(1)
    .map((m) => ({ m, pairs: renameMap(ref, m) }))
    .filter((x) => x.pairs.length > 0)
    .map((x) => `${x.m.name}: ${x.pairs.map(([a, b]) => `${a} → ${b}`).join(", ")}`);
  const literals =
    level === "shape"
      ? sorted
          .slice(1)
          .map((m) => ({ m, pairs: literalChanges(ref, m) }))
          .filter((x) => x.pairs.length > 0)
          .map((x) => `${x.m.name}: ${x.pairs.slice(0, 6).map(([a, b]) => `${a} → ${b}`).join(", ")}`)
      : [];
  const names = [...new Set(sorted.map((m) => m.name))].sort();
  return {
    fingerprint: fingerprint("exact-clone", sorted.map((m) => m.body).sort(), names),
    kind: "exact-clone",
    category: "duplicate",
    locations: sorted.map((m) => ({ path: m.path, startLine: m.startLine, endLine: m.endLine, symbol: m.name })),
    evidence: [
      {
        label: "shape",
        value: level === "exact" ? `${sorted.length} copies identical after renaming local names` : `${sorted.length} copies identical after renaming local names and constants`,
      },
      { label: "unit", value: ref.kind },
      { label: "tokens", value: String(ref.tokens) },
      ...(renames.length ? [{ label: "renamed", value: `reference ${ref.name}; ${renames.join(" | ")}` }] : [{ label: "renamed", value: "none — the same text" }]),
      ...(literals.length ? [{ label: "constants", value: literals.join(" | ") }] : []),
    ],
    confidence: level === "exact" ? "high" : "medium",
    suggestedAction: "review",
    verifyHint:
      level === "exact"
        ? "The listed units are the same code under other local names; keep one and call it from the other places, then re-scan."
        : "The listed units share their code and differ only in constants; one unit with those constants as parameters would replace them — check that callers agree, then re-scan.",
    source: SOURCE,
  };
}

function cssFinding(rules: CssRule[], shared: string[] | null): FindingType {
  const sorted = [...rules].sort(byLocation);
  const types = new Set<string>();
  for (const r of sorted.slice(1)) for (const t of duplicationTypes(sorted[0]!, r)) types.add(t);
  const decls = shared ?? [...sorted[0]!.decls.entries()].map(([k, v]) => `${k}: ${v}`).sort();
  const selectors = sorted.map((r) => r.selector);
  return {
    fingerprint: fingerprint("css-duplicate", shared ? [shared.join(";")] : sorted.map((r) => r.text).sort(), [...new Set(selectors)].sort()),
    kind: "css-duplicate",
    category: "duplicate",
    locations: sorted.map((r) => ({ path: r.path, startLine: r.startLine, endLine: r.endLine, symbol: r.selector })),
    evidence: [
      { label: "shape", value: shared ? `${sorted.length} rules of one stylesheet share ${decls.length} declarations` : `${sorted.length} rules with equivalent declarations` },
      ...(shared ? [] : [{ label: "duplication-types", value: [...types].sort().join(", ") }]),
      { label: "selectors", value: selectors.join(" | ") },
      ...(sorted[0]!.context ? [{ label: "context", value: sorted[0]!.context }] : []),
      { label: "declarations", value: decls.slice(0, 24).join("; ") + (decls.length > 24 ? `; … (+${decls.length - 24})` : "") },
    ],
    confidence: shared ? "medium" : "high",
    suggestedAction: "review",
    verifyHint: shared
      ? "These rules repeat the same declarations; a grouping selector or shared class could hold them once — check that rule order does not change what wins, then re-scan."
      : "These rules style with the same declarations under other selectors; one rule (or a shared class) could replace them — check the cascade order, then re-scan.",
    source: SOURCE,
  };
}

/**
 * Refactoring opportunities among rules of one stylesheet and context, chosen as Mazinanian et al.
 * (FSE 2014) rank them: a declaration set shared by ≥ minFamilies property families saves
 * |declarations| × (|rules| − 1) once extracted into a grouping selector. Opportunities are taken
 * greedily by saving, each (rule, declaration) pair counted once, while a saving reaches minSaved
 * and at most maxPerFile per stylesheet — every rule pair shares a few declarations in a large
 * stylesheet, so all closed sets would flood the report.
 */
function sharedSets(
  rules: CssRule[],
  minFamilies: number,
  wholeKeys: Set<string>,
  minSaved: number,
  maxPerFile: number,
): Array<{ rules: CssRule[]; decls: string[] }> {
  const picked: Array<{ rules: CssRule[]; decls: string[] }> = [];
  for (const group of groupBy(rules, (r) => r.path)) {
    const candidates = closedSets(group, minFamilies, wholeKeys);
    const covered = new Set<string>();
    const saving = (s: { rules: CssRule[]; decls: string[] }) => {
      const free = s.decls.filter((d) => s.rules.filter((r) => !covered.has(`${r.startLine}\n${d}`)).length >= 2);
      // Counted in property families: `border: none` expands to twelve longhands but is one declaration to move.
      return { free, saved: new Set(free.map((d) => familyOf(d.split(":")[0]!))).size * (s.rules.length - 1) };
    };
    for (let n = 0; n < maxPerFile; n++) {
      let best: { set: { rules: CssRule[]; decls: string[] }; free: string[]; saved: number } | null = null;
      for (const set of candidates) {
        const { free, saved } = saving(set);
        if (!best || saved > best.saved) best = { set, free, saved };
      }
      if (!best || best.saved < minSaved) break;
      picked.push({ rules: best.set.rules, decls: best.free });
      for (const r of best.set.rules) for (const d of best.free) covered.add(`${r.startLine}\n${d}`);
    }
  }
  return picked;
}

/** Closed declaration sets shared by ≥ minFamilies property families among rules of one stylesheet and context. */
function closedSets(rules: CssRule[], minFamilies: number, wholeKeys: Set<string>): Array<{ rules: CssRule[]; decls: string[] }> {
  const out: Array<{ rules: CssRule[]; decls: string[] }> = [];
  for (const group of groupBy(rules, (r) => `${r.path}\n${r.context}`)) {
    if (group.length > MAX_RULES_FOR_SHARED_SETS) continue;
    const entries = group.map((r) => new Set([...r.decls.entries()].map(([k, v]) => `${k}: ${v}`)));
    const candidates = new Map<string, string[]>();
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const common = [...entries[i]!].filter((d) => entries[j]!.has(d));
        const families = new Set(common.map((d) => familyOf(d.split(":")[0]!)));
        if (families.size < minFamilies) continue;
        if (common.length === entries[i]!.size && common.length === entries[j]!.size) continue; // whole-rule duplicate
        const sorted = common.sort();
        candidates.set(sorted.join("\n"), sorted);
      }
    }
    const sets = [...candidates.values()].map((decls) => ({ decls, members: group.filter((_, k) => decls.every((d) => entries[k]!.has(d))) }));
    for (const s of sets) {
      // Closed sets only: drop a set when a larger set has exactly the same members.
      const dominated = sets.some((o) => o !== s && o.decls.length > s.decls.length && o.members.length === s.members.length && s.decls.every((d) => o.decls.includes(d)));
      if (dominated || s.members.length < 2) continue;
      if (s.members.every((m) => wholeKeys.has(ruleKey(m))) && new Set(s.members.map(ruleKey)).size === 1) continue;
      out.push({ rules: s.members, decls: s.decls });
    }
  }
  return out;
}

export async function runNormalizedClones(ctx: AdapterContext): Promise<FindingType[]> {
  const cfg = ctx.config.clones;
  const findings: FindingType[] = [];

  const units: NormalizedUnit[] = [];
  for (const file of ctx.filesWithRole("source")) units.push(...normalizedUnits(file, await ctx.readFile(file), cfg.minTokens, cfg.minLines));
  const exact = outermost(groupBy(units, (u) => `${u.kind}\n${u.exactKey}`));
  const inExact = new Set(exact.flat());
  for (const g of exact) findings.push(cloneFinding(g, "exact"));
  const shape = outermost(groupBy(units, (u) => `${u.kind}\n${u.shapeKey}`))
    // A shape group adds something only when it is not one exact group already.
    .filter((g) => !g.every((m) => inExact.has(m)) || new Set(g.map((m) => m.exactKey)).size > 1);
  for (const g of shape) findings.push(cloneFinding(g, "shape"));

  const rules: CssRule[] = [];
  for (const file of ctx.styleFilesWithRole?.("source") ?? []) rules.push(...cssRules(file, await ctx.readFile(file)));
  // Counted in property families, so a shorthand and its longhands weigh the same (type III).
  const eligible = rules.filter((r) => new Set([...r.decls.keys()].map(familyOf)).size >= cfg.cssMinRuleDeclarations);
  const whole = groupBy(eligible, ruleKey);
  const wholeKeys = new Set(whole.map((g) => ruleKey(g[0]!)));
  for (const g of whole) findings.push(cssFinding(g, null));
  for (const s of sharedSets(rules, cfg.cssMinSharedProperties, wholeKeys, cfg.cssMinSavedDeclarations, cfg.cssMaxSharedSetsPerFile)) {
    findings.push(cssFinding(s.rules, s.decls));
  }

  return findings.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}
