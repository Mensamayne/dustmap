/**
 * One finding per duplicated concept (DUP-06). Several layers report the same copies: token clones
 * (jscpd), L1 normalized copies, L2 near copies, L3 meaning (semantic, with the L4 judge). Findings of
 * the duplicate categories that stand for the same set of places are merged into one: each place of
 * either corresponds to a place of the other (same file, overlap ≥ half of the smaller range, sizes
 * within a factor of two). A set inside a larger set is another group and stays — three identical loops
 * inside a group of seven loops alike in meaning are two true statements, not one. The strongest member
 * leads (confidence, then layer: L1 > L2 > L3 > token) and keeps its fingerprint; the others add the
 * evidence the leader lacks (judge, sketch, direction, diff), and every merged finding says which layers
 * found it. A strictly smaller fragment inside a larger place (a token fragment in a function, a
 * function in a copied file) becomes a listed part of the larger finding instead of a report of its own.
 */
import type { Evidence, FindingType } from "@dustmap/contract";

type Place = FindingType["locations"][number];

const DUPLICATE_CATEGORIES = new Set(["duplicate", "semantic-duplicate"]);

/** Layer of a duplicate finding, strongest first. */
const LAYERS: Array<{ test: (f: FindingType) => boolean; name: string }> = [
  { test: (f) => f.kind === "exact-clone" || f.kind === "css-duplicate", name: "L1 normalized copy" },
  { test: (f) => f.kind === "near-clone", name: "L2 near copy" },
  { test: (f) => f.kind === "semantic-cluster", name: "L3 same meaning" },
  { test: (f) => f.kind === "clone-cluster", name: "token copy (jscpd)" },
];
const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 } as const;
/** Evidence a member brings to the leader when the leader has none of that label. */
const CARRIED = ["judge", "sketch", "sketch-blocked", "direction", "diff", "renamed", "duplication-types"];

function layerIndex(f: FindingType): number {
  const k = LAYERS.findIndex((l) => l.test(f));
  return k < 0 ? LAYERS.length : k;
}

const span = (p: Place) => ({ start: p.startLine ?? 1, end: p.endLine ?? p.startLine ?? 1 });

/** The same place: one file, overlap ≥ half of the smaller range, neither more than twice the other. */
export function samePlace(a: Place, b: Place): boolean {
  if (a.path !== b.path) return false;
  const x = span(a);
  const y = span(b);
  const overlap = Math.min(x.end, y.end) - Math.max(x.start, y.start) + 1;
  if (overlap <= 0) return false;
  const la = x.end - x.start + 1;
  const lb = y.end - y.start + 1;
  return overlap * 2 >= Math.min(la, lb) && Math.max(la, lb) <= 2 * Math.min(la, lb);
}

/** Every place of `a` corresponds to a place of `b`. */
const covers = (a: FindingType, b: FindingType) => a.locations.every((p) => b.locations.some((q) => samePlace(p, q)));

/** Merge duplicate-category findings that stand for the same places; other findings pass through. */
export function mergeDuplicateLayers(all: readonly FindingType[]): FindingType[] {
  const dups = all.filter((f) => DUPLICATE_CATEGORIES.has(f.category));
  const rest = all.filter((f) => !DUPLICATE_CATEGORIES.has(f.category));
  const parent = dups.map((_, k) => k);
  const find = (k: number): number => (parent[k] === k ? k : (parent[k] = find(parent[k]!)));
  const byPath = new Map<string, number[]>();
  dups.forEach((f, k) => {
    for (const p of new Set(f.locations.map((l) => l.path))) {
      const list = byPath.get(p);
      if (list) list.push(k);
      else byPath.set(p, [k]);
    }
  });
  dups.forEach((f, k) => {
    const near = new Set(f.locations.flatMap((l) => byPath.get(l.path) ?? []));
    for (const o of near) {
      if (o <= k || find(o) === find(k)) continue;
      if (covers(f, dups[o]!) && covers(dups[o]!, f)) parent[find(o)] = find(k);
    }
  });
  const groups = new Map<number, FindingType[]>();
  dups.forEach((f, k) => {
    const root = find(k);
    const g = groups.get(root);
    if (g) g.push(f);
    else groups.set(root, [f]);
  });

  const merged: FindingType[] = [];
  for (const members of groups.values()) {
    const ranked = [...members].sort(
      (a, b) => CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence] || layerIndex(a) - layerIndex(b) || a.fingerprint.localeCompare(b.fingerprint),
    );
    const lead = ranked[0]!;
    const layerOf = (f: FindingType) => LAYERS[layerIndex(f)]?.name ?? f.kind;
    const layers: Evidence = { label: "layer", value: layerOf(lead) };
    if (members.length === 1) {
      merged.push({ ...lead, evidence: [...lead.evidence, layers] });
      continue;
    }
    const have = new Set(lead.evidence.map((e) => e.label));
    const carried: Evidence[] = [];
    for (const f of ranked.slice(1)) {
      for (const e of f.evidence) {
        if (!CARRIED.includes(e.label) || have.has(e.label)) continue;
        have.add(e.label);
        carried.push(e);
      }
    }
    const found = ranked.map((f) => `${layerOf(f)} — ${f.kind} ${f.confidence} (${f.fingerprint})`).join("; ");
    merged.push({
      ...lead,
      evidence: [...lead.evidence, ...carried, layers, { label: "found-by", value: `${members.length} layers agree on these places: ${found}` }],
    });
  }
  return [...rest, ...foldParts(merged)];
}

const inside = (p: Place, q: Place) => p.path === q.path && span(p).start >= span(q).start && span(p).end <= span(q).end;

/**
 * The same copy relation at a smaller scale: every place of `part` is a strictly smaller fragment inside
 * its own place of `whole` (a token fragment in a near-copied function pair, a copied function in a
 * copied file). The same places in a smaller set are not a part: that is another group.
 */
function isPartOf(part: FindingType, whole: FindingType): boolean {
  if (part === whole || part.locations.length > whole.locations.length) return false;
  const used = new Set<number>();
  for (const p of part.locations) {
    const k = whole.locations.findIndex((q, i) => !used.has(i) && inside(p, q) && !samePlace(p, q));
    if (k < 0) return false;
    used.add(k);
  }
  return true;
}

const MAX_PARTS_LISTED = 12;
/** A part's own sketch and diff describe the fragment, not the whole: they are not carried up. */
const CARRIED_FROM_PARTS = new Set(["judge", "direction"]);

/** Findings that are parts of a larger finding become a line of its evidence instead of a report of their own. */
function foldParts(findings: FindingType[]): FindingType[] {
  const largestFirst = [...findings].sort((a, b) => totalLines(b) - totalLines(a));
  // A whole holds every place of its part, so it shares the part's first file: look only there.
  const byPath = new Map<string, FindingType[]>();
  for (const f of largestFirst) {
    for (const p of new Set(f.locations.map((l) => l.path))) {
      const list = byPath.get(p);
      if (list) list.push(f);
      else byPath.set(p, [f]);
    }
  }
  const owner = new Map<FindingType, FindingType>();
  for (const f of largestFirst) {
    const candidates = byPath.get(f.locations[0]!.path) ?? [];
    const whole = candidates.find((w) => w !== f && !owner.has(w) && totalLines(w) > totalLines(f) && isPartOf(f, w));
    if (whole) owner.set(f, whole);
  }
  const parts = new Map<FindingType, FindingType[]>();
  for (const [part, whole] of owner) {
    const list = parts.get(whole);
    if (list) list.push(part);
    else parts.set(whole, [part]);
  }
  return findings
    .filter((f) => !owner.has(f))
    .map((f) => {
      const own = parts.get(f);
      if (!own) return f;
      const have = new Set(f.evidence.map((e) => e.label));
      const carried = own.flatMap((p) => p.evidence.filter((e) => CARRIED_FROM_PARTS.has(e.label) && !have.has(e.label) && (have.add(e.label), true)));
      const listed = own
        .slice(0, MAX_PARTS_LISTED)
        .map((p) => `${p.kind} ${p.confidence} ${p.locations.map((l) => `${l.symbol ?? ""}${l.symbol ? " " : ""}${l.path.split("/").pop()}:${l.startLine}-${l.endLine}`).join(" ↔ ")}`);
      if (own.length > MAX_PARTS_LISTED) listed.push(`… (+${own.length - MAX_PARTS_LISTED})`);
      // A part says how certain the part is, not the whole: the whole keeps its own confidence.
      return { ...f, evidence: [...f.evidence, ...carried, { label: "parts", value: `${own.length} smaller findings inside these places: ${listed.join("; ")}` }] };
    });
}

function totalLines(f: FindingType): number {
  return f.locations.reduce((s, l) => s + span(l).end - span(l).start + 1, 0);
}
