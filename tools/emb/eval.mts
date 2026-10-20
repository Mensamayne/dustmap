#!/usr/bin/env tsx
/**
 * EMB meter: how well does a semantic provider tell "same meaning" from "looks alike" on the gold set
 * (tools/emb/gold). Every provider goes through Dustmap's own code path, so the number is what users get.
 *
 *   npm run emb:eval                                   current product path (jscpd --semantic, jina)
 *   npm run emb:eval -- --provider http --url http://127.0.0.1:8080/v1 --model <id>
 *   npm run emb:eval -- --selftest                     oracle / inverted / random must land where expected
 *
 * Options: --threshold 0.82 · --concurrency 4 · --note "…" · --no-write (skip results table).
 * Private pairs are read from the pinned snapshot (.tmp/targets/…); missing snapshot = public only.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cosineSimilarity, createOpenAiCompatibleProvider, runJscpdSemanticPairs } from "@dustmap/core";
import { summarize } from "./metrics.mjs";

type Side = { name: string; code: string };
type GoldPair = { id: string; label: "same" | "pattern" | "different"; split: "validation" | "test"; source: string; a: Side; b: Side };
type Scored = GoldPair & { score: number | null };
type PrivateRef = { repo: string; sha: string; path: string; startLine: number; endLine: number; name: string; kind: string; sha256: string };

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const goldDir = path.join(repo, "tools/emb/gold");
const argv = process.argv.slice(2);
const arg = (name: string, fallback?: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[i + 1]! : fallback;
};
const has = (name: string) => argv.includes(`--${name}`);

const jsonl = <T,>(file: string): T[] =>
  readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l) as T);

/** Private sides read back from the pinned snapshot; a drifted or missing side drops the pair. */
function loadPrivate(): { pairs: GoldPair[]; note: string } {
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

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

/** Today's product path: jscpd --semantic on a two-file tree per pair (so one pair cannot hide another). */
async function scoreCurrent(pairs: GoldPair[], model: string, concurrency: number): Promise<Scored[]> {
  return pool(pairs, concurrency, async (p) => {
    const dir = mkdtempSync(path.join(tmpdir(), "dustmap-emb-"));
    try {
      writeFileSync(path.join(dir, "a.ts"), `${p.a.code}\n`);
      writeFileSync(path.join(dir, "b.ts"), `${p.b.code}\n`);
      const found = await runJscpdSemanticPairs(dir, ["a.ts", "b.ts"], { model, sameThreshold: 0.01, minTokens: 10, minLines: 3 });
      const cross = found.filter((x) => x.a.path !== x.b.path).map((x) => x.similarity);
      return { ...p, score: cross.length ? Math.max(...cross) : null };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

/** Any OpenAI-compatible embeddings endpoint through Dustmap's provider (loopback only by default). */
async function scoreHttp(pairs: GoldPair[], url: string, model: string): Promise<Scored[]> {
  const provider = createOpenAiCompatibleProvider({ url, model, allowRemote: false });
  const texts = [...new Set(pairs.flatMap((p) => [p.a.code, p.b.code]))];
  const vectors = new Map<string, number[]>();
  for (let i = 0; i < texts.length; i += 32) {
    const batch = texts.slice(i, i + 32);
    const vs = await provider.embed(batch);
    batch.forEach((t, k) => vectors.set(t, vs[k]!));
  }
  return pairs.map((p) => ({ ...p, score: cosineSimilarity(vectors.get(p.a.code)!, vectors.get(p.b.code)!) }));
}

/** Seeded pseudo-random score — the "model knows nothing" baseline. */
function randomScore(id: string): number {
  return createHash("sha256").update(id).digest().readUInt32BE(0) / 0xffffffff;
}

function dirBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const p = path.join(dir, e.name);
    return sum + (e.isDirectory() ? dirBytes(p) : statSync(p).size);
  }, 0);
}

function fmt(x: number | null | undefined, digits = 3): string {
  return typeof x === "number" ? x.toFixed(digits) : "—";
}

function selftest(pairs: GoldPair[]): never {
  const base = pairs.filter((p) => p.label === "same").length / pairs.length;
  const runs = {
    oracle: summarize(pairs.map((p) => ({ ...p, score: p.label === "same" ? 0.95 : 0.2 })), 0.82),
    inverted: summarize(pairs.map((p) => ({ ...p, score: p.label === "same" ? 0.2 : 0.95 })), 0.82),
    random: summarize(pairs.map((p) => ({ ...p, score: randomScore(p.id) })), 0.82),
  };
  const checks: Array<[string, boolean]> = [
    ["wyrocznia → AP 1.0", runs.oracle.ap > 0.999],
    ["wyrocznia → precyzja i wykrywalność 1.0", runs.oracle.at.precision === 1 && runs.oracle.at.recall === 1],
    ["odwrócona wyrocznia → AP ≤ odsetek same + 0.05", runs.inverted.ap <= base + 0.05],
    [`losowe wyniki → AP blisko odsetka same (${base.toFixed(2)} ± 0.15)`, Math.abs(runs.random.ap - base) <= 0.15],
    ["brak wyniku liczony jako 0, nie pomijany", summarize(pairs.map((p) => ({ ...p, score: null })), 0.82).at.recall === 0],
  ];
  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
    if (!ok) failed++;
  }
  console.log(failed ? `emb meter selftest: ${failed} FAIL` : "emb meter selftest: OK — miernik nie kłamie");
  process.exit(failed ? 1 : 0);
}

function appendResults(row: string): void {
  const file = path.join(repo, "docs/experiments/emb-results.md");
  const header = [
    "# Wyniki: „ten sam sens” na zbiorze wzorcowym (EMB)",
    "",
    "Każdy wiersz to jeden przebieg `npm run emb:eval` na zbiorze z `tools/emb/gold` (EMB-01). **same** = ta sama logika (klasa pozytywna); **pattern** i **different** = negatywy. Główna liczba to **AP** (średnia precyzja rankingu: 1,0 = wszystkie pary `same` nad wszystkimi pozostałymi; los ≈ odsetek par `same`). „Brak wyniku” = dostawca w ogóle nie połączył pary (liczone jako 0). Zbiór `test` jest odłożony — nie trenujemy ani nie stroimy na nim progów.",
    "",
    "| Data | Dostawca / model | Zbiór | Par | AP | Precyzja @próg | Wykrywalność @próg | `pattern` pod progiem | Najlepszy próg (F1) | Brak wyniku | Śr. same / pattern / different | Czas | Rozmiar modelu | Uwagi |",
    "|---|---|---|--:|--:|--:|--:|--:|---|--:|---|--:|--:|---|",
  ].join("\n");
  const current = existsSync(file) ? readFileSync(file, "utf8").trimEnd() : header;
  writeFileSync(file, `${current}\n${row}\n`);
}

async function main(): Promise<void> {
  const publicPairs = jsonl<GoldPair>(path.join(goldDir, "public.jsonl"));
  const priv = loadPrivate();
  const pairs = [...publicPairs, ...priv.pairs];
  if (has("selftest")) selftest(pairs);

  const provider = arg("provider", "current")!;
  const threshold = Number(arg("threshold", "0.82"));
  const model = arg("model", provider === "current" ? "jina-embeddings-v2-base-code" : undefined);
  const t0 = Date.now();
  let scored: Scored[];
  let size = "—";
  if (provider === "current") {
    scored = await scoreCurrent(pairs, model!, Number(arg("concurrency", "4")));
    const bytes = dirBytes(path.join(process.env.LOCALAPPDATA ?? "", "jscpd/cache/models", `jinaai--${model}`));
    if (bytes) size = `${Math.round(bytes / 1024 / 1024)} MB`;
  } else if (provider === "http") {
    if (!arg("url") || !model) throw new Error("--provider http needs --url and --model");
    scored = await scoreHttp(pairs, arg("url")!, model);
  } else if (provider === "random") {
    scored = pairs.map((p) => ({ ...p, score: randomScore(p.id) }));
  } else {
    throw new Error(`Unknown --provider ${provider} (current | http | random)`);
  }
  const seconds = (Date.now() - t0) / 1000;

  const sets: Array<[string, Scored[]]> = [
    ["test", scored.filter((p) => p.split === "test")],
    ["całość", scored],
  ];
  const label = provider === "current" ? `obecny: jscpd --semantic · ${model}` : `${provider}${model ? ` · ${model}` : ""}`;
  const notes = [arg("note"), priv.note].filter(Boolean).join("; ");
  console.log(`\n${label} · ${pairs.length} par (${priv.pairs.length} prywatnych) · ${seconds.toFixed(1)} s\n`);
  for (const [name, set] of sets) {
    const s = summarize(set, threshold);
    console.log(
      `${name.padEnd(7)} AP ${fmt(s.ap)} · @${threshold}: precyzja ${fmt(s.at.precision)} wykrywalność ${fmt(s.at.recall)} · pattern pod progiem ${fmt(s.at.patternBelow)} · najlepszy próg ${fmt(s.best.threshold)} (F1 ${fmt(s.best.f1)}) · brak wyniku ${s.noScore}/${s.pairs}`,
    );
    console.log(`        średnio: same ${fmt(s.mean.same)} · pattern ${fmt(s.mean.pattern)} · different ${fmt(s.mean.different)}`);
    if (!has("no-write")) {
      appendResults(
        `| ${new Date().toLocaleDateString("sv-SE")} | ${label} | ${name} | ${s.pairs} | ${fmt(s.ap)} | ${fmt(s.at.precision)} | ${fmt(s.at.recall)} | ${fmt(s.at.patternBelow)} | ${fmt(s.best.threshold)} (F1 ${fmt(s.best.f1, 2)}) | ${s.noScore} | ${fmt(s.mean.same, 2)} / ${fmt(s.mean.pattern, 2)} / ${fmt(s.mean.different, 2)} | ${seconds.toFixed(0)} s | ${size} | ${notes} |`,
      );
    }
  }
  const rawDir = path.join(repo, ".tmp/emb");
  mkdirSync(rawDir, { recursive: true });
  // Ids and scores only — no code, so private pairs never land in a file by accident.
  const raw = scored.map(({ id, label: l, split, score }) => ({ id, label: l, split, score }));
  writeFileSync(path.join(rawDir, `run-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), JSON.stringify({ provider, model, threshold, raw }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
});
