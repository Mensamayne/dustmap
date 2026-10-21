/**
 * The EMB gold set as the meter and the calibration read it: public pairs from tools/emb/gold, private
 * pairs read back from the pinned Monorepo-A snapshot (a drifted side drops the pair, never the run).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type Side = { name: string; code: string };
export type GoldPair = { id: string; label: "same" | "pattern" | "different"; split: "validation" | "test"; source: string; a: Side; b: Side };
export type Scored = GoldPair & { score: number | null };
type PrivateRef = { repo: string; sha: string; path: string; startLine: number; endLine: number; name: string; kind: string; sha256: string };

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const goldDir = path.join(repo, "tools/emb/gold");

export const jsonl = <T,>(file: string): T[] =>
  readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l) as T);

/** Private sides read back from the pinned snapshot; a drifted or missing side drops the pair. */
export function loadPrivate(): { pairs: GoldPair[]; note: string } {
  const refs = jsonl<Omit<GoldPair, "a" | "b"> & { a: PrivateRef; b: PrivateRef }>(path.join(goldDir, "private-refs.jsonl"));
  if (refs.length === 0) return { pairs: [], note: "" };
  const first = refs[0]!.a;
  const snap = path.join(repo, ".tmp/targets", `${first.repo}@${first.sha.slice(0, 12)}`, "src");
  if (!existsSync(snap)) {
    return { pairs: [], note: `bez par prywatnych: brak migawki (npm run target -- ${first.repo} --snapshot ${first.sha})` };
  }
  const read = (r: PrivateRef): Side | null => {
    const span = readFileSync(path.join(snap, r.path), "utf8").split(/\r?\n/).slice(r.startLine - 1, r.endLine).join("\n");
    if (createHash("sha256").update(span).digest("hex") !== r.sha256) return null;
    // Class members and object properties are not valid on their own; wrap them for parsers.
    const code =
      r.kind === "class-member" ? `class GoldWrapper {\n${span}\n}` : r.kind === "object-property" ? `const goldWrapper = {\n${span}\n};` : span;
    return { name: r.name, code };
  };
  const pairs: GoldPair[] = [];
  let drifted = 0;
  for (const r of refs) {
    const a = read(r.a);
    const b = read(r.b);
    if (!a || !b) drifted++;
    else pairs.push({ ...r, a, b });
  }
  return { pairs, note: drifted ? `${drifted} par prywatnych pominiętych: kod pod odnośnikiem się zmienił` : "" };
}

/** Every gold pair: public ones plus the private ones the snapshot can still serve. */
export function loadGold(): { pairs: GoldPair[]; privateCount: number; note: string } {
  const pub = jsonl<GoldPair>(path.join(goldDir, "public.jsonl"));
  const priv = loadPrivate();
  return { pairs: [...pub, ...priv.pairs], privateCount: priv.pairs.length, note: priv.note };
}
