/**
 * Near copies and containment among script units (DUP-02, layer L2), no model. Units are compared on
 * their normalized lines (locals blindly renamed, literals by value, NiCad style). Candidates come from
 * an inverted index over distinct lines with prefix filtering (SourcererCC): lines are ordered rare
 * first, and two units sharing at least θ of the smaller unit's lines must share one of its first
 * |lines| − ⌈θ·|lines|⌉ + 1 lines, so only those are looked up. Each candidate is verified by a longest
 * common subsequence of lines weighted by tokens:
 *   near-miss — the shared part is ≥ minSimilarity of the larger unit (someone changed or added lines);
 *   contains  — the shared part is ≥ minCoverage of the smaller unit, but the larger one adds more.
 * The diff of that subsequence is the evidence: shared, changed and added lines, and the rename map.
 */
import type { NormalizedLine, NormalizedUnit } from "./normalize-ts.js";

export type NearOptions = {
  /** Smallest unit considered, in significant normalized lines. */
  minLines: number;
  /** near-miss: shared tokens / tokens of the larger unit. */
  minSimilarity: number;
  /** contains: shared tokens / tokens of the smaller unit. */
  minCoverage: number;
};

export type DiffOp = { op: "same"; a: NormalizedLine; b: NormalizedLine } | { op: "del"; a: NormalizedLine } | { op: "ins"; b: NormalizedLine };

export type NearPair = {
  /** For `contains`, `a` is the contained (smaller) unit. */
  a: NormalizedUnit;
  b: NormalizedUnit;
  relation: "near-miss" | "contains";
  /** Shared tokens / tokens of the larger unit. */
  similarity: number;
  /** Shared tokens / tokens of the smaller unit. */
  coverage: number;
  ops: DiffOp[];
};

/** Below this filter threshold a pair cannot pass either verification (weights differ from counts, so it is lower). */
const FILTER_THETA = 0.5;
/** Pairs whose line matrix exceeds this are not verified (two classes of thousands of lines). */
const MAX_LCS_CELLS = 2_000_000;

/** A line that carries meaning: not only brackets and punctuation. */
const significant = (l: NormalizedLine): boolean => /[\w$"'`]/.test(l.text);

const weight = (lines: readonly NormalizedLine[]): number => lines.reduce((s, l) => s + l.tokens, 0);

const inside = (x: NormalizedUnit, y: NormalizedUnit): boolean =>
  x !== y && x.path === y.path && x.startLine >= y.startLine && x.endLine <= y.endLine;

/** Longest common subsequence of lines, weighted by tokens, as a diff script from a to b. */
export function lineDiff(a: readonly NormalizedLine[], b: readonly NormalizedLine[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const w = new Float64Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      w[at(i, j)] = a[i]!.text === b[j]!.text ? a[i]!.tokens + w[at(i + 1, j + 1)]! : Math.max(w[at(i + 1, j)]!, w[at(i, j + 1)]!);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i]!.text === b[j]!.text && w[at(i, j)] === a[i]!.tokens + w[at(i + 1, j + 1)]!) ops.push({ op: "same", a: a[i++]!, b: b[j++]! });
    else if (w[at(i + 1, j)]! >= w[at(i, j + 1)]!) ops.push({ op: "del", a: a[i++]! });
    else ops.push({ op: "ins", b: b[j++]! });
  }
  while (i < n) ops.push({ op: "del", a: a[i++]! });
  while (j < m) ops.push({ op: "ins", b: b[j++]! });
  return ops;
}

/**
 * Near-miss and containment pairs among units. `related(x, y)` says two units are already one L1
 * group; such pairs, and pairs whose enclosing units are already related or reported, are left out —
 * the outer finding covers them. Only units for which `compared` holds are paired (one per L1 group);
 * all units count as enclosing ones.
 */
export function nearPairs(
  units: readonly NormalizedUnit[],
  opts: NearOptions,
  related: (x: NormalizedUnit, y: NormalizedUnit) => boolean,
  compared: (u: NormalizedUnit) => boolean,
): NearPair[] {
  const seqs = units.map((u) => u.lines.filter(significant));
  const ids = units.map((_, k) => k).filter((k) => compared(units[k]!) && seqs[k]!.length >= opts.minLines);
  const df = new Map<string, number>();
  const distinct = new Map<number, string[]>();
  for (const k of ids) {
    const set = [...new Set(seqs[k]!.map((l) => l.text))];
    distinct.set(k, set);
    for (const t of set) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const index = new Map<string, number[]>();
  for (const k of ids) {
    for (const t of distinct.get(k)!) {
      const list = index.get(t);
      if (list) list.push(k);
      else index.set(t, [k]);
    }
  }

  const candidates = new Set<string>();
  for (const k of ids) {
    const items = [...distinct.get(k)!].sort((x, y) => df.get(x)! - df.get(y)! || (x < y ? -1 : x > y ? 1 : 0));
    const prefix = items.length - Math.ceil(FILTER_THETA * items.length) + 1;
    const size = distinct.get(k)!.length;
    for (const t of items.slice(0, prefix)) {
      for (const o of index.get(t)!) {
        if (o === k) continue;
        // The smaller unit queries; equal sizes once, from the lower index.
        const os = distinct.get(o)!.length;
        if (os < size || (os === size && o < k)) continue;
        candidates.add(`${k},${o}`);
      }
    }
  }

  const verified: NearPair[] = [];
  for (const c of candidates) {
    const [x, y] = c.split(",").map(Number) as [number, number];
    const ux = units[x]!;
    const uy = units[y]!;
    if (ux.exactKey === uy.exactKey || ux.shapeKey === uy.shapeKey) continue;
    if (inside(ux, uy) || inside(uy, ux)) continue;
    const sx = seqs[x]!;
    const sy = seqs[y]!;
    if (sx.length * sy.length > MAX_LCS_CELLS) continue;
    const wx = weight(sx);
    const wy = weight(sy);
    // The smaller unit comes first (for contains: the contained one); equal sizes in file order.
    const first = wx < wy || (wx === wy && (ux.path < uy.path || (ux.path === uy.path && ux.startLine < uy.startLine)));
    const [a, b, sa, sb] = first ? [ux, uy, sx, sy] : [uy, ux, sy, sx];
    const ops = lineDiff(sa, sb);
    const shared = ops.reduce((sum, o) => sum + (o.op === "same" ? o.a.tokens : 0), 0);
    const similarity = shared / Math.max(wx, wy);
    const coverage = shared / Math.min(wx, wy);
    if (similarity >= opts.minSimilarity) verified.push({ a, b, relation: "near-miss", similarity, coverage, ops });
    else if (coverage >= opts.minCoverage) verified.push({ a, b, relation: "contains", similarity, coverage, ops });
  }

  const verifiedWith = new Map<NormalizedUnit, Set<NormalizedUnit>>();
  for (const p of verified) for (const [x, y] of [[p.a, p.b], [p.b, p.a]] as const) verifiedWith.set(x, (verifiedWith.get(x) ?? new Set()).add(y));

  // Outer pairs first: a pair whose units sit inside an already kept pair (or an L1 group) adds nothing.
  verified.sort((p, q) => q.a.tokens + q.b.tokens - (p.a.tokens + p.b.tokens));
  const byPath = new Map<string, NormalizedUnit[]>();
  for (const u of units) {
    const list = byPath.get(u.path);
    if (list) list.push(u);
    else byPath.set(u.path, [u]);
  }
  const enclosing = (u: NormalizedUnit): NormalizedUnit[] => [u, ...(byPath.get(u.path) ?? []).filter((o) => inside(u, o))];
  const kept: NearPair[] = [];
  const pairKey = new Map<NormalizedUnit, Set<NormalizedUnit>>();
  const isKept = (x: NormalizedUnit, y: NormalizedUnit) => pairKey.get(x)?.has(y) ?? false;
  for (const p of verified) {
    const covered = enclosing(p.a).some((x) => enclosing(p.b).some((y) => (x !== p.a || y !== p.b) && x !== y && (related(x, y) || isKept(x, y))));
    if (covered) continue;
    // One side matches a piece of the other directly (a method against the class that holds its copy):
    // that inner pair is the finding. Two copied classes stay one finding — no method matches a class.
    const matched = (x: NormalizedUnit, y: NormalizedUnit) => related(x, y) || (verifiedWith.get(x)?.has(y) ?? false);
    const piece = (whole: NormalizedUnit, other: NormalizedUnit) => (byPath.get(whole.path) ?? []).some((u) => inside(u, whole) && matched(other, u));
    if (piece(p.b, p.a) || piece(p.a, p.b)) continue;
    kept.push(p);
    for (const [x, y] of [[p.a, p.b], [p.b, p.a]] as const) pairKey.set(x, (pairKey.get(x) ?? new Set()).add(y));
  }
  return kept;
}

export type NearGroup = {
  relation: NearPair["relation"];
  /** near-miss: the unit with most near copies; contains: the contained unit. */
  center: NormalizedUnit;
  /** Every other unit with the pair that ties it into the group (to the center, or along a chain of near copies). */
  members: Array<{ unit: NormalizedUnit; pair: NearPair }>;
};

/**
 * One finding per family instead of one per pair (Aroma-style clustering): near copies form connected
 * groups around the unit with most near copies, reached breadth first; a contained unit forms a group
 * with every unit that contains it.
 */
export function nearGroups(pairs: readonly NearPair[]): NearGroup[] {
  const groups: NearGroup[] = [];
  const containers = new Map<NormalizedUnit, NearPair[]>();
  const adjacent = new Map<NormalizedUnit, NearPair[]>();
  const push = <K>(map: Map<K, NearPair[]>, k: K, p: NearPair) => {
    const list = map.get(k);
    if (list) list.push(p);
    else map.set(k, [p]);
  };
  for (const p of pairs) {
    if (p.relation === "contains") push(containers, p.a, p);
    else {
      push(adjacent, p.a, p);
      push(adjacent, p.b, p);
    }
  }
  for (const [center, ps] of containers) groups.push({ relation: "contains", center, members: ps.map((pair) => ({ unit: pair.b, pair })) });

  const byDegree = [...adjacent.keys()].sort(
    (x, y) => adjacent.get(y)!.length - adjacent.get(x)!.length || y.tokens - x.tokens || x.path.localeCompare(y.path) || x.startLine - y.startLine,
  );
  const seen = new Set<NormalizedUnit>();
  for (const center of byDegree) {
    if (seen.has(center)) continue;
    seen.add(center);
    const members: NearGroup["members"] = [];
    const queue = [center];
    while (queue.length) {
      const u = queue.shift()!;
      for (const pair of adjacent.get(u)!) {
        const other = pair.a === u ? pair.b : pair.a;
        if (seen.has(other)) continue;
        seen.add(other);
        members.push({ unit: other, pair });
        queue.push(other);
      }
    }
    groups.push({ relation: "near-miss", center, members });
  }
  return groups;
}

/** Diff counts: lines shared, changed (a removed line replaced in place), only in a, only in b. */
export function diffCounts(ops: readonly DiffOp[]): { same: number; changed: number; onlyA: number; onlyB: number } {
  let same = 0;
  let changed = 0;
  let onlyA = 0;
  let onlyB = 0;
  for (let i = 0; i < ops.length; ) {
    if (ops[i]!.op === "same") {
      same++;
      i++;
      continue;
    }
    let dels = 0;
    let ins = 0;
    while (i < ops.length && ops[i]!.op !== "same") ops[i++]!.op === "del" ? dels++ : ins++;
    changed += Math.min(dels, ins);
    onlyA += dels - Math.min(dels, ins);
    onlyB += ins - Math.min(dels, ins);
  }
  return { same, changed, onlyA, onlyB };
}

/** Local names that sit in the same place of shared lines, `a → b`, in first-seen order. */
export function nearRenames(ops: readonly DiffOp[]): Array<[string, string]> {
  const out = new Map<string, string>();
  for (const o of ops) {
    if (o.op !== "same") continue;
    o.a.locals.forEach((name, k) => {
      const other = o.b.locals[k];
      if (other !== undefined && other !== name && !out.has(name)) out.set(name, other);
    });
  }
  return [...out.entries()];
}

/** File lines shown for one logical line: at most this many, joined by ` ⏎ `. */
const MAX_SPANS = 3;

/**
 * The diff as text an agent can read without opening the files: `-` lines only in a, `+` lines only
 * in b, with their file line numbers and original source text; shared lines are not repeated, and a
 * file line holding several logical lines (`<b>text</b>`) is printed once.
 */
export function diffText(p: NearPair, maxLines: number): string {
  const text = (u: NormalizedUnit, l: NormalizedLine): string => {
    const src = u.body.split(/\r?\n/);
    const shown = l.spans.slice(0, MAX_SPANS).map((n) => (src[n - u.startLine] ?? "").trim());
    return shown.join(" ⏎ ") + (l.spans.length > MAX_SPANS ? " ⏎ …" : "");
  };
  const out: string[] = [];
  let last = "";
  for (const o of p.ops) {
    if (o.op === "same") continue;
    const [sign, u, l] = o.op === "del" ? (["-", p.a, o.a] as const) : (["+", p.b, o.b] as const);
    const key = `${sign}${l.line}`;
    if (key === last) continue;
    last = key;
    out.push(`${sign} ${u.name}:${l.line} ${text(u, l)}`);
  }
  return out.length > maxLines ? `${out.slice(0, maxLines).join("\n")}\n… (+${out.length - maxLines} lines)` : out.join("\n");
}
