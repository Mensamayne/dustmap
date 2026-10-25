/**
 * Build semantic-cluster findings from scored function pairs, as decided in DUST-15: functions linked
 * by similarity form groups (average linkage) — one function in N copies is one finding with N places; and
 * several separate pairs between the same two files become one finding, "two parallel systems".
 * Pairs come from every function pair (similarity.ts, exact). Confidence: from the model's calibrated
 * bands (calibration.ts) when it has them, else ≥0.85 medium / low (DUST-15 spike, uncalibrated
 * models). A group whose every link is a deliberate pattern (calibration.ts sharedPattern) gets one
 * level less and the pattern as evidence. Parallel-file groups (≥2 matched function pairs between
 * the same two files) also drop one level: twin scenario/scaffold files, not a single copied helper.
 */
import { fingerprint, type FindingType } from "@dustmap/contract";
import { confidenceFor, lowerConfidence, sharedPattern, type Calibration, type Confidence } from "./calibration.js";
import type { PairHeadClass } from "./pair-head.js";
import { pairsAtLeast } from "./similarity.js";

export type SemanticFunctionRef = {
  path: string;
  name: string;
  startLine: number;
  endLine: number;
  body: string;
};

export type SemanticPair = {
  a: SemanticFunctionRef;
  b: SemanticFunctionRef;
  similarity: number;
  /** When set by the PAIR head: `pattern` demotes confidence like sharedPattern. */
  pairClass?: PairHeadClass;
  /** Pair judge probability of the same job (DUP-04), when a judge read the pair. */
  judge?: number;
};

/** What judged the pairs of a run: a judge package id with its threshold, or why none did. */
export type JudgeNote = { id: string; threshold: number } | { missing: string };

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Every function pair with cosine similarity ≥ threshold (i < j), exact; vectors are normalised first. */
export async function pairsAboveThreshold(
  fns: readonly SemanticFunctionRef[],
  vectors: readonly number[][],
  threshold: number,
): Promise<SemanticPair[]> {
  const unit = vectors.map((v) => {
    const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return n === 0 ? v : v.map((x) => x / n);
  });
  return (await pairsAtLeast(unit, threshold)).map(({ i, j, similarity }) => ({ a: fns[i]!, b: fns[j]!, similarity }));
}

/**
 * Groups of functions by average linkage: links are visited strongest first, and two groups merge
 * only when the mean similarity over every cross pair reaches the threshold. Cross pairs below the
 * threshold come from `similarity` (exact, from the vectors) or count as 0 when it is not given. One
 * weak link can no longer chain two unrelated families into one finding (single linkage did: two
 * families of three bridged by one 0.42 link became seven places).
 */
function averageLinkageGroups(
  edges: ReadonlyMap<string, number>,
  threshold: number,
  similarity: ((a: string, b: string) => number) | null,
): string[][] {
  const group = new Map<string, number>();
  const members = new Map<number, string[]>();
  const sim = (a: string, b: string) => edges.get(a < b ? `${a}\n${b}` : `${b}\n${a}`) ?? (similarity ? similarity(a, b) : 0);
  const ordered = [...edges.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
  let next = 0;
  for (const [key] of ordered) {
    const [a, b] = key.split("\n") as [string, string];
    for (const k of [a, b]) {
      if (!group.has(k)) {
        group.set(k, next);
        members.set(next++, [k]);
      }
    }
    const ga = group.get(a)!;
    const gb = group.get(b)!;
    if (ga === gb) continue;
    const ma = members.get(ga)!;
    const mb = members.get(gb)!;
    let total = 0;
    for (const x of ma) for (const y of mb) total += sim(x, y);
    if (total / (ma.length * mb.length) < threshold) continue;
    for (const y of mb) group.set(y, ga);
    members.set(ga, [...ma, ...mb]);
    members.delete(gb);
  }
  return [...members.values()].filter((m) => m.length >= 2).map((m) => m.sort());
}

function fnKey(f: SemanticFunctionRef): string {
  return `${f.path}\0${f.name}\0${f.startLine}\0${f.endLine}`;
}

/** True when both are in the same file and one span is strictly inside the other (nested helper vs outer). */
export function isNestedSpanPair(a: SemanticFunctionRef, b: SemanticFunctionRef): boolean {
  if (a.path !== b.path) return false;
  const aInB = a.startLine > b.startLine && a.endLine < b.endLine;
  const bInA = b.startLine > a.startLine && b.endLine < a.endLine;
  return aInB || bInA;
}

type Group = { members: string[]; shape: "copies" | "parallel-files" };

/** Components of linked functions; two-function components between the same two files merge into one. */
function groups(components: string[][], byKey: Map<string, SemanticFunctionRef>): Group[] {
  const out: Group[] = [];
  const byFilePair = new Map<string, string[][]>();
  for (const members of components) {
    if (members.length === 2) {
      const [x, y] = members.map((k) => byKey.get(k)!.path);
      if (x !== y) {
        const key = [x, y].sort().join("\0");
        byFilePair.set(key, [...(byFilePair.get(key) ?? []), members]);
        continue;
      }
    }
    out.push({ members, shape: "copies" });
  }
  for (const comps of byFilePair.values()) {
    if (comps.length === 1) out.push({ members: comps[0]!, shape: "copies" });
    else out.push({ members: comps.flat(), shape: "parallel-files" });
  }
  return out;
}

/**
 * Cluster pairs into semantic-cluster findings: a group of N copies of one function, or two files
 * with several matching functions (parallel systems).
 */
export function clusterSemanticPairs(
  pairs: readonly SemanticPair[],
  threshold: number,
  calibration: Calibration | null = null,
  /** Exact similarity of any two functions (from their vectors) for the linkage test; else unlinked = 0. */
  similarity: ((a: SemanticFunctionRef, b: SemanticFunctionRef) => number) | null = null,
  judged: JudgeNote | null = null,
): FindingType[] {
  if (pairs.length === 0) return [];

  const byKey = new Map<string, SemanticFunctionRef>();
  const edgeSims = new Map<string, number>(); // unordered pair of fn keys → max sim
  const pairClassByEdge = new Map<string, PairHeadClass>();
  const judgeByEdge = new Map<string, number>();

  for (const p of pairs) {
    if (p.similarity < threshold) continue;
    // Nested helper vs its outer function in the same file is not a duplicate (false high on large apps).
    if (isNestedSpanPair(p.a, p.b)) continue;
    const ka = fnKey(p.a);
    const kb = fnKey(p.b);
    byKey.set(ka, p.a);
    byKey.set(kb, p.b);
    const ek = ka < kb ? `${ka}\n${kb}` : `${kb}\n${ka}`;
    const prev = edgeSims.get(ek) ?? 0;
    if (p.similarity >= prev) {
      edgeSims.set(ek, p.similarity);
      if (p.pairClass) pairClassByEdge.set(ek, p.pairClass);
      if (p.judge !== undefined) judgeByEdge.set(ek, p.judge);
    }
  }

  const components = averageLinkageGroups(edgeSims, threshold, similarity ? (a, b) => similarity(byKey.get(a)!, byKey.get(b)!) : null);
  const findings: FindingType[] = [];
  for (const { members, shape } of groups(components, byKey)) {
    const fns = members.map((k) => byKey.get(k)!);
    const sims: number[] = [];
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i]!;
        const b = members[j]!;
        const ek = a < b ? `${a}\n${b}` : `${b}\n${a}`;
        const s = edgeSims.get(ek);
        if (s !== undefined) sims.push(s);
      }
    }
    const judgeScores: number[] = [];
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i]!;
        const b = members[j]!;
        const s = judgeByEdge.get(a < b ? `${a}\n${b}` : `${b}\n${a}`);
        if (s !== undefined) judgeScores.push(s);
      }
    }
    // The judge demotes, never deletes: a group whose every judged pair reads as a pattern or different
    // work stays visible at low confidence (type-4 duplicates are where the judge is weakest).
    const judgeThreshold = judged && "id" in judged ? judged.threshold : null;
    const accepted = judgeThreshold === null ? 0 : judgeScores.filter((s) => s >= judgeThreshold).length;
    const judgeRejects = judgeThreshold !== null && judgeScores.length > 0 && accepted === 0;
    const minSim = sims.length ? Math.min(...sims) : threshold;
    const maxSim = sims.length ? Math.max(...sims) : threshold;

    const paths = [...new Set(fns.map((f) => f.path))].sort();
    const names = [...new Set(fns.map((f) => f.name))].sort();
    // Every member's code: editing any function of the group yields a new fingerprint (BUG-07).
    const bodies = fns.map((f) => f.body).sort();
    const fp = fingerprint("semantic-cluster", bodies, names);

    let confidence: Confidence = (calibration ? confidenceFor(maxSim, calibration) : null) ?? (maxSim >= 0.85 ? "medium" : "low");
    // A deliberate pattern only when every linked pair of the group shares one.
    const linked: Array<[SemanticFunctionRef, SemanticFunctionRef]> = [];
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i]!;
        const b = members[j]!;
        if (edgeSims.has(a < b ? `${a}\n${b}` : `${b}\n${a}`)) linked.push([byKey.get(a)!, byKey.get(b)!]);
      }
    }
    const patterns = linked.map(([a, b]) => sharedPattern(a.body, b.body));
    const pattern = patterns.length > 0 && patterns.every((x) => x !== null) ? patterns[0]! : null;
    const pairHeadPattern =
      linked.length > 0 &&
      linked.every(([a, b]) => {
        const key = fnKey(a) < fnKey(b) ? `${fnKey(a)}\n${fnKey(b)}` : `${fnKey(b)}\n${fnKey(a)}`;
        return pairClassByEdge.get(key) === "pattern";
      });
    // Parallel files already means ≥2 cross-file pairs (groups()); demote once even without a syntax pattern.
    const parallelTwins = shape === "parallel-files";
    if (pattern || parallelTwins || pairHeadPattern) confidence = lowerConfidence(confidence);
    if (judgeRejects) confidence = "low";

    findings.push({
      fingerprint: fp,
      kind: "semantic-cluster",
      category: "semantic-duplicate",
      locations: fns
        .map((f) => ({
          path: f.path,
          startLine: f.startLine,
          endLine: f.endLine,
          symbol: f.name,
        }))
        .sort((a, b) => a.path.localeCompare(b.path) || (a.startLine ?? 0) - (b.startLine ?? 0)),
      evidence: [
        { label: "shape", value: shape === "parallel-files" ? `parallel files: ${sims.length} matching function pairs between 2 files` : `copies: ${fns.length} functions` },
        { label: "functions", value: String(fns.length) },
        { label: "pairs", value: String(sims.length) },
        { label: "similarity-min", value: minSim.toFixed(3) },
        { label: "similarity-max", value: maxSim.toFixed(3) },
        { label: "names", value: names.join(", ") },
        { label: "files", value: String(paths.length) },
        ...(pattern ? [{ label: "shared-pattern", value: pattern }] : []),
        ...(parallelTwins && !pattern ? [{ label: "shared-pattern", value: "parallel file twins (≥2 matched functions between two files)" }] : []),
        ...(pairHeadPattern && !pattern ? [{ label: "shared-pattern", value: "pair-head: pattern (same skeleton, different job)" }] : []),
        ...(judged
          ? [
              {
                label: "judge",
                value:
                  "id" in judged
                    ? `${judged.id}: ${accepted} of ${judgeScores.length} linked pairs read as the same job (probability ${Math.min(...judgeScores).toFixed(2)}–${Math.max(...judgeScores).toFixed(2)}, threshold ${judged.threshold})${judgeRejects ? " — reads as a shared pattern or different work: low confidence, check by hand" : ""}`
                    : `not judged — ${judged.missing}; similarity only`,
              },
            ]
          : []),
      ],
      confidence,
      suggestedAction: "review",
      verifyHint:
        shape === "parallel-files"
          ? "Two files implement the same set of functions; compare them side by side, keep one system if they do the same job, then re-scan."
          : "Compare the listed functions; extract shared behaviour if they truly do the same job, then re-scan.",
      source: "semantic",
    });
  }

  return findings.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}
