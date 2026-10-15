/**
 * Build semantic-cluster findings from scored function pairs: union-find across overlapping
 * functions, then group by connected components. Confidence: ≥0.85 medium, else low (spike).
 */
import { fingerprint, type FindingType } from "@dustmap/contract";

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
};

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

/** All pairs with similarity ≥ threshold (i < j). */
export function pairsAboveThreshold(
  fns: readonly SemanticFunctionRef[],
  vectors: readonly number[][],
  threshold: number,
): SemanticPair[] {
  const pairs: SemanticPair[] = [];
  for (let i = 0; i < fns.length; i++) {
    for (let j = i + 1; j < fns.length; j++) {
      const sim = cosineSimilarity(vectors[i]!, vectors[j]!);
      if (sim >= threshold) {
        pairs.push({ a: fns[i]!, b: fns[j]!, similarity: sim });
      }
    }
  }
  return pairs;
}

class UnionFind {
  private readonly parent = new Map<string, string>();
  add(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }
  find(id: string): string {
    let cur = id;
    while (this.parent.get(cur) !== cur) {
      const p = this.parent.get(cur);
      if (p === undefined) {
        this.parent.set(cur, cur);
        return cur;
      }
      this.parent.set(cur, this.parent.get(p) ?? p);
      cur = this.parent.get(cur)!;
    }
    return cur;
  }
  union(a: string, b: string): void {
    this.add(a);
    this.add(b);
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
  components(): Map<string, string[]> {
    const g = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const r = this.find(id);
      const list = g.get(r);
      if (list) list.push(id);
      else g.set(r, [id]);
    }
    return g;
  }
}

function fnKey(f: SemanticFunctionRef): string {
  return `${f.path}\0${f.name}\0${f.startLine}\0${f.endLine}`;
}

/** Declares that look like factory/config objects (defineX({...})) — demote confidence. */
export function looksLikeConfigFactory(body: string): boolean {
  return /\b[a-zA-Z_$][\w$]*\s*\(\s*\{/.test(body) && /(?:name|id|handler|run)\s*:/.test(body);
}

/**
 * Cluster pairs into semantic-cluster findings. Several pairs between the same two files become
 * one finding (spike: parallel systems). Transitive function links become one multi-place cluster.
 */
export function clusterSemanticPairs(pairs: readonly SemanticPair[], threshold: number): FindingType[] {
  if (pairs.length === 0) return [];

  const uf = new UnionFind();
  const byKey = new Map<string, SemanticFunctionRef>();
  const edgeSims = new Map<string, number>(); // unordered pair of fn keys → max sim

  for (const p of pairs) {
    if (p.similarity < threshold) continue;
    const ka = fnKey(p.a);
    const kb = fnKey(p.b);
    byKey.set(ka, p.a);
    byKey.set(kb, p.b);
    uf.union(ka, kb);
    const ek = ka < kb ? `${ka}\n${kb}` : `${kb}\n${ka}`;
    edgeSims.set(ek, Math.max(edgeSims.get(ek) ?? 0, p.similarity));
  }

  const findings: FindingType[] = [];
  for (const members of uf.components().values()) {
    if (members.length < 2) continue;
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
    const minSim = sims.length ? Math.min(...sims) : threshold;
    const maxSim = sims.length ? Math.max(...sims) : threshold;

    const paths = [...new Set(fns.map((f) => f.path))].sort();
    const names = [...new Set(fns.map((f) => f.name))].sort();
    const bodies = fns.map((f) => f.body).sort();
    const fp = fingerprint("semantic-cluster", bodies.slice(0, 4), names);

    const allFactory = fns.every((f) => looksLikeConfigFactory(f.body));
    let confidence: "low" | "medium" = maxSim >= 0.85 ? "medium" : "low";
    if (allFactory) confidence = "low";

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
        { label: "functions", value: String(fns.length) },
        { label: "similarity-min", value: minSim.toFixed(3) },
        { label: "similarity-max", value: maxSim.toFixed(3) },
        { label: "names", value: names.join(", ") },
        { label: "files", value: String(paths.length) },
      ],
      confidence,
      suggestedAction: "review",
      verifyHint:
        "Compare the listed functions; extract shared behaviour if they truly do the same job, then re-scan.",
      source: "semantic",
    });
  }

  return findings.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}
