#!/usr/bin/env tsx
/**
 * DUP meter (DUP-03): one number per layer of duplicate detection, on the same gold set as the EMB meter
 * (tools/emb/gold), each through Dustmap's own code path. One AP over pairs stops being the measure of
 * progress; every layer answers its own question:
 *
 *   L1/L2 — of the gold pairs normalization would report (exact / same shape / near copy / contains),
 *           how many are duplicates (precision), and how many duplicates they catch (recall per label).
 *   L3    — is the real partner among the k nearest units of the whole repository (recall@10/20/50),
 *           with the scan's own units and the `onnx` model package, as a scan embeds them.
 *   L4    — a pair judge's scores (any judge, from a file of {id, score} or {id, judge: {score}}):
 *           AP and precision at 0.5 on the held-out test split and on everything.
 *   trap  — the same-file sibling pairs (hard negatives): how many each layer would report.
 *
 *   npm run dup:meter -- [--model <onnx package id>] [--device auto|gpu|cpu] [--judge <scores.jsonl>] [--no-l3]
 *
 * Positives are same + contains + concept, as in the EMB meter. Private pairs are read from the pinned
 * snapshots; nothing with code is written — vectors go to the git-ignored .tmp/emb cache.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  cosineSimilarity,
  cssRules,
  DustmapConfig,
  extractUnits,
  loadConfig,
  nearPairs,
  normalizedUnits,
  openOnnxProvider,
  openVectorCache,
  ruleKey,
  takeInventory,
  type CodeUnit,
  type NormalizedUnit,
} from "@dustmap/core";
import { loadGold, repo, type GoldPair, type Side } from "./gold-data.mts";
import { summarize } from "./metrics.mjs";

const argv = process.argv.slice(2);
const arg = (name: string, fallback?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[i + 1]! : fallback;
};
const has = (name: string) => argv.includes(`--${name}`);
const fmt = (x: number | null | undefined, digits = 3) => (typeof x === "number" ? x.toFixed(digits) : "—");
const POSITIVE = new Set(["same", "contains", "concept"]);
const LABELS = ["same", "contains", "concept", "pattern", "different"] as const;
const KS = [10, 20, 50] as const;

// ── L1 / L2 ──────────────────────────────────────────────────────────────────────────────────────

type Verdict = "exact" | "shape" | "near-miss" | "contains" | "css-equal" | null;

const clones = DustmapConfig.parse({}).clones;
const WRAPPERS = new Set(["GoldWrapper", "goldWrapper"]);

/** The unit a side stands for: its outermost function or class, never the parser wrapper of a member. */
function unitOf(side: Side, file: string): NormalizedUnit | null {
  const units = normalizedUnits(file, side.code, clones.minTokens, clones.minLines).filter((u) => !WRAPPERS.has(u.name));
  if (units.length === 0) return null;
  return units.reduce((best, u) => (u.endLine - u.startLine > best.endLine - best.startLine ? u : best));
}

/** What layers L1/L2 of a scan would say about this pair, with the product's default thresholds. */
function normalizedVerdict(p: GoldPair): Verdict {
  if (p.unit === "css") {
    const a = cssRules("a.css", p.a.code);
    const b = cssRules("b.css", p.b.code);
    return a.length === 1 && b.length === 1 && ruleKey(a[0]!) === ruleKey(b[0]!) ? "css-equal" : null;
  }
  const a = unitOf(p.a, p.a.path ?? "a.tsx");
  const b = unitOf(p.b, p.b.path ?? "b.tsx");
  if (!a || !b) return null;
  if (a.exactKey === b.exactKey) return "exact";
  if (a.shapeKey === b.shapeKey) return "shape";
  const near = nearPairs(
    [a, b],
    { minLines: clones.nearMinLines, minSimilarity: clones.nearMinSimilarity, minCoverage: clones.containMinCoverage },
    () => false,
    () => true,
  );
  return near[0]?.relation ?? null;
}

type Judged = { p: GoldPair; v: Verdict };

function reportL12(pairs: GoldPair[], trap: GoldPair[]): Judged[] {
  const judged: Judged[] = pairs.map((p) => ({ p, v: normalizedVerdict(p) }));
  const verdicts = ["exact", "shape", "css-equal", "near-miss", "contains"] as const;
  console.log(`\nL1/L2 — normalizacja (progi produktu) na ${pairs.length} parach złota`);
  const row = (name: string, hits: typeof judged) => {
    const byLabel = LABELS.map((l) => `${l} ${hits.filter((h) => h.p.label === l).length}`).join(" · ");
    const pos = hits.filter((h) => POSITIVE.has(h.p.label)).length;
    const strict = hits.filter((h) => h.p.label === "same" || h.p.label === "contains").length;
    console.log(
      `  ${name.padEnd(10)} zgłasza ${String(hits.length).padStart(4)} · precyzja ${fmt(hits.length ? pos / hits.length : null)} (same+contains ${fmt(hits.length ? strict / hits.length : null)}) · ${byLabel}`,
    );
  };
  for (const v of verdicts) row(v, judged.filter((h) => h.v === v));
  row("L1 razem", judged.filter((h) => h.v === "exact" || h.v === "shape" || h.v === "css-equal"));
  row("L2 razem", judged.filter((h) => h.v === "near-miss" || h.v === "contains"));
  const any = judged.filter((h) => h.v !== null);
  row("L1+L2", any);
  const recall = ["same", "contains", "concept"].map((l) => {
    const all = judged.filter((h) => h.p.label === l);
    return `${l} ${fmt(all.length ? all.filter((h) => h.v !== null).length / all.length : null)} (${all.length})`;
  });
  console.log(`  wykrywalność L1+L2 per etykieta: ${recall.join(" · ")}`);
  const wrong = any.filter((h) => !POSITIVE.has(h.p.label));
  for (const h of wrong.slice(0, 8)) console.log(`    fałszywy alarm: ${h.v} · ${h.p.label} · ${h.p.id} · ${h.p.a.name} ↔ ${h.p.b.name}`);
  const trapHits = trap.filter((p) => normalizedVerdict(p) !== null).length;
  console.log(`  pułapka: zgłasza ${trapHits}/${trap.length} (mniej = lepiej)`);
  return judged;
}

// ── L3 ───────────────────────────────────────────────────────────────────────────────────────────

const overlap = (u: { startLine: number; endLine: number }, s: { startLine: number; endLine: number }) =>
  Math.max(0, Math.min(u.endLine, s.endLine) - Math.max(u.startLine, s.startLine) + 1) /
  (Math.max(u.endLine, s.endLine) - Math.min(u.startLine, s.startLine) + 1);

/** The scan's unit at a side's place: exact lines, else the unit covering most of it (≥ half). */
function placeOf(side: Side, units: readonly CodeUnit[]): number | null {
  let best = -1;
  let score = 0.5;
  units.forEach((u, k) => {
    if (u.path !== side.path) return;
    const o = overlap(u, { startLine: side.startLine!, endLine: side.endLine! });
    if (o > score || (o === score && best < 0)) {
      best = k;
      score = o;
    }
  });
  return best >= 0 ? best : null;
}

async function reportL3(pairs: GoldPair[], model: string, device: "auto" | "gpu" | "cpu"): Promise<void> {
  const located = pairs.filter((p) => !p.trap && POSITIVE.has(p.label) && p.a.repo && p.a.repo === p.b.repo && p.a.sha === p.b.sha && p.a.path && p.b.path);
  const bySnapshot = new Map<string, GoldPair[]>();
  for (const p of located) {
    const key = `${p.a.repo}@${p.a.sha!.slice(0, 12)}`;
    bySnapshot.set(key, [...(bySnapshot.get(key) ?? []), p]);
  }
  const provider = await openOnnxProvider({ model, device });
  try {
    for (const [snap, group] of bySnapshot) {
      const root = path.join(repo, ".tmp/targets", snap, "src");
      const configFile = path.join(repo, "tools/targets", `${snap.split("@")[0]}.dustmap.config.json`);
      if (!existsSync(root) || !existsSync(configFile)) {
        console.log(`\nL3 — ${snap}: brak migawki albo konfiguracji (${group.length} par pominiętych)`);
        continue;
      }
      const t0 = Date.now();
      const { config } = loadConfig(root, configFile);
      const inv = takeInventory(root, config, "full");
      const units: CodeUnit[] = [];
      for (const f of inv.files) {
        if (inv.roles.get(f) !== "source") continue;
        units.push(...extractUnits(f, inv.contents.get(f) ?? readFileSync(path.join(root, f), "utf8")));
      }
      // Sides the scan does not cut as units still take part — as extra entries, counted apart.
      const extra: string[] = [];
      const indexOf = (side: Side): number => {
        const k = placeOf(side, units);
        if (k !== null) return k;
        extra.push(side.code);
        return units.length + extra.length - 1;
      };
      const queries = group.map((p) => ({ p, a: indexOf(p.a), b: indexOf(p.b) }));
      const texts = [...units.map((u) => u.body), ...extra];
      const cache = openVectorCache(path.join(repo, ".tmp/emb/dup-meter-vectors", model), provider.modelId);
      const items = texts.map((t) => ({ contentHash: createHash("sha256").update(t).digest("hex"), text: t }));
      const { vectors, newEmbeddings } = await cache.embedMissing(items, provider);
      cache.flush();
      const placeOfIndex = (k: number) => (k < units.length ? units[k]! : null);
      const hits: Record<string, Record<number, number>> = {};
      const count: Record<string, number> = {};
      for (const { p, a, b } of queries) {
        const qa = placeOfIndex(a);
        const target = placeOfIndex(b);
        const sims = vectors.map((v, k) => {
          const u = placeOfIndex(k);
          // The query's own pieces (its fragments, its enclosing unit) are not candidates.
          if (k === a || (qa && u && u.path === qa.path && overlap(u, qa) > 0)) return -2;
          return cosineSimilarity(vectors[a]!, v);
        });
        // The partner or any piece of it (a fragment, its enclosing class) counts as found.
        const partner = sims.reduce(
          (best, s, k) => {
            const u = placeOfIndex(k);
            const isPartner = k === b || (target && u && u.path === target.path && overlap(u, target) > 0);
            return isPartner && s > best ? s : best;
          },
          -3,
        );
        const rank = sims.filter((s) => s > partner).length + 1;
        for (const l of [p.label, "all"]) {
          count[l] = (count[l] ?? 0) + 1;
          hits[l] ??= {};
          for (const k of KS) if (rank <= k) hits[l]![k] = (hits[l]![k] ?? 0) + 1;
        }
      }
      console.log(
        `\nL3 — partner w top-k · ${snap} · model ${model} (${provider.variant}) · pula ${texts.length} jednostek (${extra.length} stron spoza cięcia skanu) · nowych wektorów ${newEmbeddings} · ${((Date.now() - t0) / 1000).toFixed(0)} s`,
      );
      for (const l of ["all", "same", "contains", "concept"]) {
        if (!count[l]) continue;
        console.log(`  ${l.padEnd(9)} n=${String(count[l]).padStart(4)}  ` + KS.map((k) => `recall@${k} ${fmt((hits[l]![k] ?? 0) / count[l]!, 2)}`).join("  "));
      }
    }
  } finally {
    await provider.release();
  }
}

// ── L4 ───────────────────────────────────────────────────────────────────────────────────────────

/**
 * A text relation (same shape, near copy, contains) is certain; whether both sides do the same job is the
 * judge's call. The combined line is what a report would show when it keeps only judged duplicates.
 */
function reportL4(pairs: GoldPair[], trap: GoldPair[], file: string, judged: Judged[]): void {
  const scores = new Map<string, number>();
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as { id: string; score?: number; judge?: { score?: number } };
    const s = r.judge?.score ?? r.score;
    if (typeof s === "number") scores.set(r.id, s);
  }
  const scored = (set: GoldPair[]) => set.map((p) => ({ ...p, score: scores.get(p.id) ?? null }));
  const covered = pairs.filter((p) => scores.has(p.id)).length;
  console.log(`\nL4 — sędzia par · ${path.basename(file)} · oceny dla ${covered}/${pairs.length} par (brak oceny liczy się jako 0)`);
  for (const [name, set] of [
    ["test", pairs.filter((p) => p.split === "test")],
    ["całość", pairs],
  ] as const) {
    const s = summarize(scored(set), 0.5);
    console.log(
      `  ${name.padEnd(7)} AP ${fmt(s.ap)} · same ${fmt(s.apByLabel.same)} · contains ${fmt(s.apByLabel.contains)} · concept ${fmt(s.apByLabel.concept)} · @0.5: precyzja ${fmt(s.at.precision)} wykrywalność ${fmt(s.at.recall)} · pattern pod 0.5 ${fmt(s.at.patternBelow)} (n=${s.pairs})`,
    );
  }
  const candidates = judged.filter((h) => h.v === "shape" || h.v === "near-miss" || h.v === "contains");
  const kept = candidates.filter((h) => (scores.get(h.p.id) ?? 0) >= 0.5);
  const pos = (list: Judged[]) => list.filter((h) => POSITIVE.has(h.p.label)).length;
  console.log(
    `  L1-kształt + L2 potwierdzone sędzią (≥ 0.5): zgłasza ${kept.length}/${candidates.length} · precyzja ${fmt(kept.length ? pos(kept) / kept.length : null)} (bez sędziego ${fmt(candidates.length ? pos(candidates) / candidates.length : null)}) · zachowane duplikaty ${pos(kept)}/${pos(candidates)}`,
  );
  const t = scored(trap);
  if (t.length) console.log(`  pułapka: ≥ 0.5 dla ${t.filter((p) => (p.score ?? 0) >= 0.5).length}/${t.length} (mniej = lepiej)`);
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const gold = loadGold();
  const trap = gold.pairs.filter((p) => p.trap);
  const pairs = gold.pairs.filter((p) => !p.trap);
  const byLabel = LABELS.map((l) => `${l} ${pairs.filter((p) => p.label === l).length}`).join(" · ");
  console.log(`DUP meter · złoto ${gold.pairs.length} par (${gold.privateCount} prywatnych, pułapka ${trap.length}) · ${byLabel}${gold.note ? `\n${gold.note}` : ""}`);

  const judged = reportL12(pairs, trap);
  if (!has("no-l3")) {
    const device = arg("device", "auto") as "auto" | "gpu" | "cpu";
    await reportL3(gold.pairs, arg("model", "dustmap-same-meaning-private")!, device);
  }
  const judge = arg("judge");
  if (judge) reportL4(pairs, trap, path.resolve(judge), judged);
  else console.log("\nL4 — sędzia par: brak pliku ocen (--judge <scores.jsonl>)");
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(2);
});
