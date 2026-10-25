/**
 * The EMB gold set as the meter and the calibration read it: public pairs from tools/emb/gold, private
 * pairs read back from the pinned snapshots (a drifted side drops the pair, never the run). Private
 * refs come from two files: private-refs.jsonl (DUST-15 groups, hand-picked) and real-refs.jsonl
 * (EMB-12 / CON-01 bands + EMB-10 same-file siblings merged via merge-same-file-siblings.mts).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { privatePath } from "../private-data.mjs";
import { loadTargets, targetDir } from "../targets/registry.mjs";

export type GoldLabel = "same" | "contains" | "concept" | "pattern" | "different";
/** CON unit bucket for meter breakdowns (function / fragment / class / css). */
export type UnitKind = "function" | "fragment" | "class" | "css" | "mixed";
/**
 * `code` is what gets embedded (class members wrapped); private sides also carry the raw `span` and where
 * it lives (repo, commit, path, lines), so the DUP meter can find the scan's own unit at that place.
 */
export type Side = {
  name: string;
  code: string;
  kind?: string;
  span?: string;
  path?: string;
  repo?: string;
  sha?: string;
  startLine?: number;
  endLine?: number;
};
export type GoldPair = {
  id: string;
  label: GoldLabel;
  split: "validation" | "test";
  source: string;
  a: Side;
  b: Side;
  /** Required when label is `contains`: which side is the expanded / containing one. */
  larger?: "a" | "b";
  /** Pair unit for CON-09+ reporting; derived from side kinds when present. */
  unit?: UnitKind;
  /**
   * CON-12: a trap pair — hard negatives harvested from one model's own top hits (EMB-10 same-file
   * siblings). Reported on their own, never inside AP or calibration: the selection is biased
   * against the model it was mined from.
   */
  trap?: boolean;
};
export type Scored = GoldPair & { score: number | null };
type PrivateRef = { repo: string; sha: string; path: string; startLine: number; endLine: number; name: string; kind: string; sha256: string };

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const goldDir = path.join(repo, "tools/emb/gold");

export const jsonl = <T,>(file: string): T[] =>
  readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l) as T);

/**
 * Real-code holdout source prefixes (EMB-12 / CON-01 / CON-03 / EMB-10 siblings).
 * Eval's „prawdziwy” slice counts pairs whose `source` equals or starts with one of these
 * (second-opinion resolve may append " + second-opinion resolve").
 */
export const REAL_SOURCE_PREFIXES = [
  "EMB-12 real",
  "CON-01 relabel",
  "CON-03 real",
  "EMB-10 same-file siblings",
  "CON-07 sibling label",
] as const;

/** Map extractor / ref `kind` onto the four CON training units. */
export function unitBucket(kind: string | undefined): Exclude<UnitKind, "mixed"> {
  if (!kind) return "function";
  if (kind === "css-rule" || kind === "css") return "css";
  if (kind === "fragment") return "fragment";
  if (kind === "class" || kind === "class-member" || kind === "object" || kind === "object-property") return "class";
  return "function";
}

export function pairUnit(aKind: string | undefined, bKind: string | undefined): UnitKind {
  const a = unitBucket(aKind);
  const b = unitBucket(bKind);
  return a === b ? a : "mixed";
}

/** @deprecated prefer isRealSource — kept for call sites that listed exact strings */
export const REAL_SOURCES = new Set<string>(REAL_SOURCE_PREFIXES);

export function isRealSource(source: string): boolean {
  return REAL_SOURCE_PREFIXES.some((p) => source === p || source.startsWith(`${p} +`));
}

/** Target checkout for `git show` (read-only) when a file is outside the pinned snapshot. */
function checkoutOf(name: string): string | null {
  const targets = loadTargets();
  if (!targets[name]) return null;
  const dir = targetDir(name, targets);
  return existsSync(dir) ? dir : null;
}

/**
 * File text at the ref's commit: the pinned snapshot first; files the snapshot leaves out (it keeps
 * only the extensions a scan config includes — CSS for one) come from the target with `git show`.
 * Each file is read once per process.
 */
function fileReader(): (r: PrivateRef) => string | null {
  const cache = new Map<string, string | null>();
  return (r) => {
    const key = `${r.repo}@${r.sha}:${r.path}`;
    if (cache.has(key)) return cache.get(key)!;
    let text: string | null = null;
    const snap = path.join(repo, ".tmp/targets", `${r.repo}@${r.sha.slice(0, 12)}`, "src", r.path);
    if (existsSync(snap)) text = readFileSync(snap, "utf8");
    else {
      const dir = checkoutOf(r.repo);
      if (dir) {
        try {
          text = execFileSync("git", ["show", `${r.sha}:${r.path}`], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
        } catch {
          text = null;
        }
      }
    }
    cache.set(key, text);
    return text;
  };
}

/** Private sides read back at their pinned commit; a drifted or missing side drops the pair. */
export function loadPrivate(): { pairs: GoldPair[]; note: string } {
  // References into private snapshots live outside git (REL-03); without them the gold is the public part.
  const refs = ["private-refs.jsonl", "real-refs.jsonl"]
    .map((f) => privatePath("gold", f))
    .filter((f) => existsSync(f))
    .flatMap((f) => jsonl<Omit<GoldPair, "a" | "b"> & { a: PrivateRef; b: PrivateRef }>(f));
  if (refs.length === 0) return { pairs: [], note: "" };
  const fileText = fileReader();
  const read = (r: PrivateRef): Side | null => {
    const text = fileText(r);
    if (text === null) return null;
    const span = text.split(/\r?\n/).slice(r.startLine - 1, r.endLine).join("\n");
    if (createHash("sha256").update(span).digest("hex") !== r.sha256) return null;
    // Class members and object properties are not valid on their own; wrap them for parsers.
    const code =
      r.kind === "class-member" ? `class GoldWrapper {\n${span}\n}` : r.kind === "object-property" ? `const goldWrapper = {\n${span}\n};` : span;
    return { name: r.name, code, kind: r.kind, span, path: r.path, repo: r.repo, sha: r.sha, startLine: r.startLine, endLine: r.endLine };
  };
  const pairs: GoldPair[] = [];
  let drifted = 0;
  for (const r of refs) {
    const a = read(r.a);
    const b = read(r.b);
    if (!a || !b) drifted++;
    else pairs.push({ ...r, a, b, unit: pairUnit(r.a.kind, r.b.kind) });
  }
  return { pairs, note: drifted ? `${drifted} par prywatnych pominiętych: kod pod odnośnikiem się zmienił albo pliku nie ma ani w migawce, ani w repo celu` : "" };
}

/** Every gold pair: public ones plus the private ones the snapshot can still serve. */
export function loadGold(): { pairs: GoldPair[]; privateCount: number; note: string } {
  const pub = jsonl<GoldPair>(path.join(goldDir, "public.jsonl"));
  const priv = loadPrivate();
  return { pairs: [...pub, ...priv.pairs], privateCount: priv.pairs.length, note: priv.note };
}
