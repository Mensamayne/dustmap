#!/usr/bin/env tsx
/**
 * CON-03: candidate pairs for gold v2 (≥1200) from pinned Monorepo-A/Service-B snapshots. Units come from
 * extractUnits (same cut as the scan). Pairs are drawn per unit kind and similarity band so low
 * bands and pattern-rule hits are labelled too. Code stays under .tmp/; git only gets refs later.
 *
 *   npx tsx tools/emb/gold/real-candidates.mts   → .tmp/con03/candidates.json
 *
 * Quotas (reviewable units only; after discard we need ≥800 labelled):
 *   fn–fn ~450, fn–frag ~220, frag–frag ~150, class–class ~200, css–css ~150, pattern-rule ~50
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { extractUnits, loadConfig, openOnnxProvider, sharedPattern, takeInventory, type CodeUnit } from "@dustmap/core";
import { jsonl, repo } from "../gold-data.mts";

type Unit = {
  repo: string;
  sha: string;
  path: string;
  startLine: number;
  endLine: number;
  name: string;
  kind: CodeUnit["kind"];
  span: string;
  body: string;
  parentName?: string;
};

type Band = readonly [lo: number, hi: number, n: number];

type TargetSpec = {
  repo: string;
  sha: string;
  config: string;
  /** Per pair-kind band quotas. */
  quotas: {
    "fn-fn": Band[];
    "fn-frag": Band[];
    "frag-frag": Band[];
    "class-class": Band[];
    "css-css": Band[];
  };
  patterns: number;
  poolCap: { function: number; fragment: number; class: number; object: number; "css-rule": number };
};

const TARGETS: TargetSpec[] = [
  {
    repo: "monorepo-a",
    sha: "dbe35aa00cd63fecf779ad4d48de922de45ce0f5",
    config: "private/targets/monorepo-a.dustmap.config.json",
    quotas: {
      "fn-fn": [
        [0.8, 1.01, 80],
        [0.7, 0.8, 90],
        [0.6, 0.7, 90],
        [0.5, 0.6, 90],
        [0.4, 0.5, 80],
        [0.3, 0.4, 70],
        [0.2, 0.3, 60],
      ],
      "fn-frag": [
        [0.7, 1.01, 60],
        [0.5, 0.7, 80],
        [0.3, 0.5, 70],
        [0.2, 0.3, 50],
      ],
      "frag-frag": [
        [0.7, 1.01, 50],
        [0.5, 0.7, 60],
        [0.3, 0.5, 50],
      ],
      "class-class": [
        [0.7, 1.01, 50],
        [0.5, 0.7, 60],
        [0.3, 0.5, 50],
        [0.2, 0.3, 40],
      ],
      "css-css": [
        [0.7, 1.01, 40],
        [0.5, 0.7, 50],
        [0.3, 0.5, 40],
      ],
    },
    patterns: 80,
    poolCap: { function: 6000, fragment: 4000, class: 2500, object: 1500, "css-rule": 3000 },
  },
  {
    repo: "service-b",
    sha: "0c0aa958e6b30160639188e78d72114f4f4fa9ea",
    config: "tools/targets/service-b.dustmap.config.json",
    quotas: {
      "fn-fn": [
        [0.6, 1.01, 12],
        [0.4, 0.6, 12],
        [0.2, 0.4, 12],
      ],
      "fn-frag": [
        [0.5, 1.01, 8],
        [0.2, 0.5, 8],
      ],
      "frag-frag": [[0.3, 1.01, 10]],
      "class-class": [
        [0.4, 1.01, 10],
        [0.2, 0.4, 8],
      ],
      "css-css": [[0.3, 1.01, 10]],
    },
    patterns: 5,
    poolCap: { function: 2000, fragment: 1500, class: 800, object: 400, "css-rule": 800 },
  },
];

let seed = 20261022;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

function shuffle<T>(xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function capPool<T>(xs: T[], n: number): T[] {
  return xs.length <= n ? xs : shuffle(xs).slice(0, n);
}

const goldSpans = ["private-refs.jsonl", "real-refs.jsonl"]
  .map((f) => path.join(repo, "tools/emb/gold", f))
  .flatMap((f) =>
    jsonl<{ a: { path: string; startLine: number; endLine: number }; b: { path: string; startLine: number; endLine: number } }>(f).flatMap((r) => [r.a, r.b]),
  );

const overlaps = (x: { path: string; startLine: number; endLine: number }, y: { path: string; startLine: number; endLine: number }) =>
  x.path === y.path && x.startLine <= y.endLine && y.startLine <= x.endLine;

function walkCssFiles(root: string): string[] {
  const out: string[] = [];
  const skip = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next"]);
  const walk = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (skip.has(ent.name)) continue;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(abs);
      else if (ent.isFile() && /\.(css|scss)$/i.test(ent.name) && statSync(abs).size < 400_000) {
        out.push(path.relative(root, abs).replace(/\\/g, "/"));
      }
    }
  };
  walk(root);
  return out;
}

function pushUnits(
  buckets: Record<"function" | "fragment" | "class" | "object" | "css-rule", Unit[]>,
  t: TargetSpec,
  f: string,
  text: string,
): void {
  const lines = text.split(/\r?\n/);
  const extracted = extractUnits(f, text, {
    minTokens: 20,
    fragmentMinFunctionLines: 40,
    fragmentWindowLines: 25,
    fragmentOverlapLines: 5,
  });
  for (const u of extracted) {
    if (u.kind === "function" || u.kind === "fragment") {
      if (u.endLine - u.startLine > 120) continue;
    } else if (u.endLine - u.startLine > 200) continue;
    const span = lines.slice(u.startLine - 1, u.endLine).join("\n");
    if (!span.trim()) continue;
    const row: Unit = {
      repo: t.repo,
      sha: t.sha,
      path: f,
      startLine: u.startLine,
      endLine: u.endLine,
      name: u.name,
      kind: u.kind,
      span,
      body: u.body,
      parentName: u.parentName,
    };
    if (u.kind in buckets) buckets[u.kind as keyof typeof buckets].push(row);
  }
}

function unitsOf(t: TargetSpec): Record<"function" | "fragment" | "class" | "object" | "css-rule", Unit[]> {
  const root = path.join(repo, ".tmp/targets", `${t.repo}@${t.sha.slice(0, 12)}`, "src");
  const { config } = loadConfig(root, path.join(repo, t.config));
  const inv = takeInventory(root, config, "full");
  const buckets: Record<"function" | "fragment" | "class" | "object" | "css-rule", Unit[]> = {
    function: [],
    fragment: [],
    class: [],
    object: [],
    "css-rule": [],
  };
  for (const f of inv.files) {
    if (inv.roles.get(f) !== "source") continue;
    pushUnits(buckets, t, f, inv.contents.get(f) ?? "");
  }
  // Default scan include has no CSS — walk stylesheets separately for css-css pairs.
  for (const f of walkCssFiles(root)) {
    try {
      pushUnits(buckets, t, f, readFileSync(path.join(root, f), "utf8"));
    } catch {
      // skip unreadable
    }
  }
  // Class quota includes multi-method object literals (same pair kind class-class).
  buckets.class = [...buckets.class, ...buckets.object];
  buckets.object = [];
  for (const k of Object.keys(buckets) as (keyof typeof buckets)[]) {
    buckets[k] = capPool(
      buckets[k].filter((u) => !goldSpans.some((g) => overlaps(u, g))),
      t.poolCap[k],
    );
  }
  return buckets;
}

function refOf(u: Unit) {
  return {
    repo: u.repo,
    sha: u.sha,
    path: u.path,
    startLine: u.startLine,
    endLine: u.endLine,
    name: u.name,
    kind: u.kind,
    sha256: createHash("sha256").update(u.span).digest("hex"),
  };
}

async function main(): Promise<void> {
  const provider = await openOnnxProvider({ model: "dustmap-same-meaning-private", device: "auto" });
  const candidates: unknown[] = [];
  const counts: Record<string, number> = {};
  try {
    for (const t of TARGETS) {
      console.log(`\n=== ${t.repo} ===`);
      const pools = unitsOf(t);
      for (const [k, xs] of Object.entries(pools)) console.log(`  pool ${k}: ${xs.length}`);

      type PoolKey = keyof typeof pools;
      const embedCache = new Map<PoolKey, Float32Array[]>();
      const embed = async (key: PoolKey) => {
        if (!embedCache.has(key)) {
          const xs = pools[key];
          console.log(`  embedding ${key} (${xs.length})…`);
          embedCache.set(key, xs.length ? await provider.embed(xs.map((u) => u.body)) : []);
        }
        return embedCache.get(key)!;
      };

      const taken = new Set<string>();
      const pickPair = (pairKind: string, a: Unit, b: Unit, band: string, sim: number) => {
        if (overlaps(a, b) || a.body === b.body) return false;
        const key = [a.path, a.startLine, a.endLine, b.path, b.startLine, b.endLine].join("|");
        const keyRev = [b.path, b.startLine, b.endLine, a.path, a.startLine, a.endLine].join("|");
        if (taken.has(key) || taken.has(keyRev)) return false;
        taken.add(key);
        const id = `real:${t.repo}:${createHash("sha1").update(key + pairKind).digest("hex").slice(0, 10)}`;
        candidates.push({
          id,
          pairKind,
          band,
          similarity: Number(sim.toFixed(3)),
          a: refOf(a),
          b: refOf(b),
          codeA: a.span,
          codeB: b.span,
        });
        counts[pairKind] = (counts[pairKind] ?? 0) + 1;
        return true;
      };

      const sampleBands = async (pairKind: string, leftKey: PoolKey, rightKey: PoolKey, bands: Band[], crossFilter?: (a: Unit, b: Unit) => boolean) => {
        const left = pools[leftKey];
        const right = pools[rightKey];
        if (!left.length || !right.length) {
          console.log(`  ${pairKind}: skip (empty pool)`);
          return;
        }
        const L = await embed(leftKey);
        const R = leftKey === rightKey ? L : await embed(rightKey);
        const samePool = leftKey === rightKey;
        for (const [lo, hi, n] of bands) {
          let got = 0;
          for (let tries = 0; got < n && tries < 8000; tries++) {
            const i = Math.floor(rnd() * left.length);
            const inBand: number[] = [];
            for (let j = 0; j < right.length; j++) {
              if (samePool && j === i) continue;
              const s = L[i]!.reduce((acc, x, k) => acc + x * R[j]![k]!, 0);
              if (s >= lo && s < hi) inBand.push(j);
            }
            if (!inBand.length) continue;
            const j = inBand[Math.floor(rnd() * inBand.length)]!;
            const a = left[i]!;
            const b = right[j]!;
            if (crossFilter && !crossFilter(a, b)) continue;
            const sim = L[i]!.reduce((acc, x, k) => acc + x * R[j]![k]!, 0);
            if (pickPair(pairKind, a, b, `${lo}-${Math.min(hi, 1)}`, sim)) got++;
          }
          console.log(`  ${pairKind} ${lo}-${hi}: ${got}/${n}`);
        }
      };

      await sampleBands("fn-fn", "function", "function", t.quotas["fn-fn"]);
      await sampleBands("fn-frag", "function", "fragment", t.quotas["fn-frag"], (fn, frag) => frag.parentName !== fn.name);
      await sampleBands("frag-frag", "fragment", "fragment", t.quotas["frag-frag"]);
      await sampleBands("class-class", "class", "class", t.quotas["class-class"]);
      await sampleBands("css-css", "css-rule", "css-rule", t.quotas["css-css"]);

      const fns = pools.function;
      const fnVecs = await embed("function");
      let pat = 0;
      for (let tries = 0; pat < t.patterns && tries < 30000; tries++) {
        const i = Math.floor(rnd() * fns.length);
        const j = Math.floor(rnd() * fns.length);
        if (i === j || !fns.length) continue;
        const sim = fnVecs[i]!.reduce((acc, x, k) => acc + x * fnVecs[j]![k]!, 0);
        if (sim < 0.2) continue;
        if (sharedPattern(fns[i]!.body, fns[j]!.body) && pickPair("fn-fn", fns[i]!, fns[j]!, "pattern-rule", sim)) pat++;
      }
      console.log(`  pattern-rule: ${pat}/${t.patterns}`);
    }
  } finally {
    await provider.release();
  }

  const outDir = path.join(repo, ".tmp/con03");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "candidates.json"), JSON.stringify(candidates, null, 1));
  writeFileSync(path.join(outDir, "counts.json"), JSON.stringify({ total: candidates.length, byPairKind: counts }, null, 2));
  console.log(`\ncandidates: ${candidates.length} → .tmp/con03/candidates.json`);
  console.log("by kind:", counts);
  if (candidates.length < 1200) {
    console.error(`NEED ≥1200 candidates, got ${candidates.length}`);
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
