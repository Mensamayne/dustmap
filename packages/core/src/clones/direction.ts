/**
 * Which member of a duplicate group is the original and which are copies (DUP-05, layer L5), from git
 * history, read-only. One `git log` pass dates every file by its first commit (renames followed to the
 * current path). Members whose files appeared on the same day, or that share a file, are dated by their
 * own lines instead: the median author time of `git blame -L` over the unit, so later edits of a few
 * lines do not make an old unit look new. Blame runs are capped per scan. No history (a snapshot, a
 * fresh repo) means no direction — never a guess.
 */
import { execFileSync } from "node:child_process";
import { toPosix } from "../posix.js";

const DAY = 86_400;
/** Below this age gap the order is not reported: same-day work is not "a copy of". */
const MIN_GAP_DAYS = 1;

export type Placed = { path: string; startLine: number; endLine: number; symbol?: string };

export type CopyDirection = {
  /** Index of the oldest member. */
  original: number;
  /** Unix seconds per member (file birth or median line time). */
  born: number[];
  /** How each member was dated. */
  by: Array<"file" | "lines">;
};

export type HistoryReader = {
  /** Copy direction of one group, or null when history cannot tell. */
  direction: (members: readonly Placed[]) => CopyDirection | null;
};

function git(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 512 * 1024 * 1024 });
}

/** First-commit time of every file that exists now, renames followed (`git log -M --name-status`). */
export function parseFileBirths(raw: string): Map<string, number> {
  // Newest commit first: a rename seen early maps the old name forward to the current one.
  const forward = new Map<string, string>();
  const current = (p: string) => {
    let cur = p;
    const seen = new Set<string>();
    while (forward.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = forward.get(cur)!;
    }
    return cur;
  };
  const births = new Map<string, number>();
  let time = 0;
  for (const line of raw.split("\n")) {
    if (line.startsWith("\u0001")) {
      time = Number(line.slice(1));
      continue;
    }
    const parts = line.split("\t");
    if (parts.length < 2) continue;
    const status = parts[0]!;
    const target = toPosix(parts[parts.length - 1]!);
    if (status.startsWith("R") && parts.length === 3) forward.set(toPosix(parts[1]!), current(target));
    const now = current(target);
    // Log runs newest → oldest, so the last time seen for a path is its birth.
    if (status !== "D") births.set(now, time);
  }
  return births;
}

/** Median author time of blamed lines (`git blame --porcelain`). */
export function parseBlameMedian(raw: string): number | null {
  const timeOf = new Map<string, number>();
  const lineTimes: number[] = [];
  let sha = "";
  for (const line of raw.split("\n")) {
    const head = /^([0-9a-f]{40}) \d+ \d+/.exec(line);
    if (head) {
      sha = head[1]!;
      continue;
    }
    if (line.startsWith("author-time ")) timeOf.set(sha, Number(line.slice(12)));
    else if (line.startsWith("\t")) {
      const t = timeOf.get(sha);
      if (t !== undefined) lineTimes.push(t);
    }
  }
  if (lineTimes.length === 0) return null;
  lineTimes.sort((a, b) => a - b);
  return lineTimes[Math.floor(lineTimes.length / 2)]!;
}

/**
 * History of one repository. `maxBlames` caps the per-unit `git blame` runs of a scan; members past the
 * cap keep their file date (or none). `rev` reads history as of that commit (the source of a pinned
 * snapshot), instead of the work tree.
 */
export function openHistory(repoRoot: string, maxBlames = 400, rev?: string): HistoryReader {
  let births: Map<string, number> | null = null;
  try {
    births = parseFileBirths(git(repoRoot, ["log", "-M", "--name-status", "--no-merges", "--format=%x01%at", ...(rev ? [rev] : [])]));
  } catch {
    births = null;
  }
  let blames = 0;
  const lineCache = new Map<string, number | null>();
  const linesBorn = (m: Placed): number | null => {
    const key = `${m.path}:${m.startLine}-${m.endLine}`;
    if (lineCache.has(key)) return lineCache.get(key)!;
    if (blames >= maxBlames) return null;
    blames++;
    let t: number | null = null;
    try {
      t = parseBlameMedian(git(repoRoot, ["blame", "--porcelain", "-w", "-M", "-L", `${m.startLine},${m.endLine}`, ...(rev ? [rev] : []), "--", m.path]));
    } catch {
      t = null;
    }
    lineCache.set(key, t);
    return t;
  };
  return {
    direction(members) {
      if (!births || births.size === 0 || members.length < 2) return null;
      const born: Array<number | null> = members.map((m) => births!.get(m.path) ?? null);
      const by: Array<"file" | "lines"> = members.map(() => "file");
      // Files of one day, or one file, cannot order their units: date the lines themselves.
      const needsLines = members.map((m, k) =>
        members.some((o, j) => j !== k && (o.path === m.path || (born[j] !== null && born[k] !== null && Math.abs(born[j]! - born[k]!) < MIN_GAP_DAYS * DAY))),
      );
      members.forEach((m, k) => {
        if (!needsLines[k]) return;
        const t = linesBorn(m);
        if (t !== null) {
          born[k] = t;
          by[k] = "lines";
        }
      });
      if (born.some((t) => t === null)) return null;
      const times = born as number[];
      const order = times.map((t, k) => ({ t, k })).sort((a, b) => a.t - b.t);
      if (order[1]!.t - order[0]!.t < MIN_GAP_DAYS * DAY) return null;
      return { original: order[0]!.k, born: times, by };
    },
  };
}

/** Evidence text: "A is the oldest (2026-03-01); B appeared 101 days later (file history)". */
export function directionText(members: readonly Placed[], d: CopyDirection): string {
  const date = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
  const name = (m: Placed) => `${m.symbol ?? "unit"} (${m.path}:${m.startLine})`;
  const o = members[d.original]!;
  const copies = members
    .map((m, k) => ({ m, k }))
    .filter(({ k }) => k !== d.original)
    .sort((a, b) => d.born[a.k]! - d.born[b.k]!)
    .map(({ m, k }) => `${name(m)} ${Math.round((d.born[k]! - d.born[d.original]!) / DAY)} days later (${d.by[k] === "lines" ? "its lines" : "its file"})`);
  return `oldest: ${name(o)}, ${date(d.born[d.original]!)} (${d.by[d.original] === "lines" ? "its lines" : "its file"}); copies: ${copies.join("; ")}`;
}
