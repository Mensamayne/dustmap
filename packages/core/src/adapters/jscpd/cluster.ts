/**
 * Collapse jscpd duplicate pairs into clone-cluster findings via union-find on overlapping
 * fragments. Fingerprints come from normalized clone text, never from file paths.
 */
import { fingerprint, type FindingType } from "@dustmap/contract";
import { isLowConfidenceCloneFragment } from "./noise.js";
import type { JscpdDuplicate, JscpdFileRef } from "./types.js";

export type CloneFragment = {
  path: string;
  startLine: number;
  endLine: number;
  fragment: string;
  lines: number;
};

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(id: string): string {
    let cur = id;
    while (this.parent.get(cur) !== cur) {
      const p = this.parent.get(cur);
      if (p === undefined) {
        this.parent.set(cur, cur);
        return cur;
      }
      const gp = this.parent.get(p) ?? p;
      this.parent.set(cur, gp);
      cur = gp;
    }
    return cur;
  }

  add(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  union(a: string, b: string): void {
    this.add(a);
    this.add(b);
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  /** All member ids grouped by root. */
  components(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const id of this.parent.keys()) {
      const root = this.find(id);
      const list = groups.get(root);
      if (list) list.push(id);
      else groups.set(root, [id]);
    }
    return groups;
  }
}

function fragId(f: CloneFragment): string {
  return `${f.path}\0${f.startLine}\0${f.endLine}`;
}

function overlaps(a: CloneFragment, b: CloneFragment): boolean {
  return a.path === b.path && a.startLine <= b.endLine && b.startLine <= a.endLine;
}

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Map a jscpd file ref onto a repo-relative POSIX path (strip optional absolute prefix). */
export function resolveClonePath(name: string, repoRootPosix: string): string {
  let n = toPosix(name);
  const root = toPosix(repoRootPosix).replace(/\/$/, "");
  if (root && (n === root || n.startsWith(`${root}/`))) {
    n = n.slice(root.length + (n === root ? 0 : 1));
  }
  return n.replace(/^\.\//, "");
}

function refToFragment(
  ref: JscpdFileRef,
  fragment: string,
  lines: number,
  pathResolver: (name: string) => string,
): CloneFragment {
  const startLine = ref.startLoc?.line ?? ref.start;
  const endLine = ref.endLoc?.line ?? ref.end;
  return {
    path: pathResolver(ref.name),
    startLine,
    endLine,
    fragment,
    lines: lines > 0 ? lines : Math.max(1, endLine - startLine + 1),
  };
}

/** Merge overlapping or adjacent line ranges in the same file into one location. */
export function coalesceLocations(locs: readonly CloneFragment[]): CloneFragment[] {
  const byPath = new Map<string, CloneFragment[]>();
  for (const loc of locs) {
    const list = byPath.get(loc.path) ?? [];
    list.push(loc);
    byPath.set(loc.path, list);
  }
  const out: CloneFragment[] = [];
  for (const group of byPath.values()) {
    group.sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
    let cur: CloneFragment = { ...group[0]! };
    for (let i = 1; i < group.length; i++) {
      const next = group[i]!;
      if (next.startLine <= cur.endLine + 1) {
        cur = {
          path: cur.path,
          startLine: cur.startLine,
          endLine: Math.max(cur.endLine, next.endLine),
          fragment: next.fragment.length > cur.fragment.length ? next.fragment : cur.fragment,
          lines: 0,
        };
        cur.lines = Math.max(1, cur.endLine - cur.startLine + 1);
      } else {
        out.push(cur);
        cur = { ...next };
      }
    }
    out.push(cur);
  }
  return out.sort((a, b) => a.path.localeCompare(b.path) || a.startLine - b.startLine);
}

/**
 * Union-find: each pair unions its two sides; fragments that overlap in the same file also union.
 * Returns one finding per connected component with ≥2 distinct locations (after coalescing).
 */
export function clusterDuplicates(
  duplicates: readonly JscpdDuplicate[],
  pathResolver: (name: string) => string,
): FindingType[] {
  const uf = new UnionFind();
  const byId = new Map<string, CloneFragment>();

  const remember = (f: CloneFragment): string => {
    const id = fragId(f);
    const prev = byId.get(id);
    if (!prev || f.fragment.length > prev.fragment.length) byId.set(id, f);
    uf.add(id);
    return id;
  };

  for (const dup of duplicates) {
    const fragment = dup.fragment ?? "";
    const lines = dup.lines ?? 0;
    const a = remember(refToFragment(dup.firstFile, fragment, lines, pathResolver));
    const b = remember(refToFragment(dup.secondFile, fragment, lines, pathResolver));
    uf.union(a, b);
  }

  const frags = [...byId.values()];
  for (let i = 0; i < frags.length; i++) {
    for (let j = i + 1; j < frags.length; j++) {
      const left = frags[i]!;
      const right = frags[j]!;
      if (overlaps(left, right)) uf.union(fragId(left), fragId(right));
    }
  }

  const findings: FindingType[] = [];
  for (const members of uf.components().values()) {
    const locs = members.map((id) => byId.get(id)!);
    // Dedupe identical path+range (same location reported via multiple pairs).
    const unique = new Map<string, CloneFragment>();
    for (const loc of locs) {
      const key = fragId(loc);
      const prev = unique.get(key);
      if (!prev || loc.fragment.length > prev.fragment.length) unique.set(key, loc);
    }
    const locations = coalesceLocations([...unique.values()]);
    if (locations.length < 2) continue;

    const representative =
      [...locations].sort((a, b) => b.fragment.length - a.fragment.length || b.lines - a.lines)[0]!;
    const totalLines = locations.reduce((sum, l) => sum + l.lines, 0);
    const low = isLowConfidenceCloneFragment(representative.fragment);
    const fp = fingerprint("clone-cluster", [representative.fragment], []);

    findings.push({
      fingerprint: fp,
      kind: "clone-cluster",
      category: "duplicate",
      locations: locations.map((l) => ({
        path: l.path,
        startLine: l.startLine,
        endLine: l.endLine,
      })),
      evidence: [
        { label: "places", value: String(locations.length) },
        { label: "lines", value: String(totalLines) },
        ...(representative.fragment
          ? [{ label: "snippet", value: representative.fragment.slice(0, 200) }]
          : []),
      ],
      confidence: low ? "low" : locations.length >= 3 ? "high" : "medium",
      suggestedAction: "review",
      verifyHint:
        "Extract the shared block into one module, update call sites, then re-scan for this cluster.",
      source: "jscpd",
    });
  }

  return findings.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}
