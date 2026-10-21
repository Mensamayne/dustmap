#!/usr/bin/env tsx
/**
 * EMB-12: candidate pairs for the real-code evaluation set (tools/emb/gold/real-refs.jsonl) from the
 * pinned private snapshots (Monorepo-A, Service-B). Functions are cut exactly as a scan cuts them, embedded
 * with the current private model, and pairs are drawn per similarity band (so every band, low ones
 * included, gets labelled — not only what the model already likes), plus pairs the structural pattern
 * rule flags. Code goes only to a local file under .tmp for hand labelling; the refs that reach git
 * carry repo / commit / path / lines / SHA-256, never code.
 *
 *   npx tsx tools/emb/gold/real-candidates.mts   → .tmp/emb12/candidates.json
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { extractFunctions, loadConfig, openOnnxProvider, sharedPattern, takeInventory } from "@dustmap/core";
import { jsonl, repo } from "../gold-data.mts";

type Fn = { repo: string; sha: string; path: string; startLine: number; endLine: number; name: string; span: string; body: string };

const TARGETS = [
  { repo: "monorepo-a", sha: "dbe35aa00cd63fecf779ad4d48de922de45ce0f5", config: "tools/targets/monorepo-a.dustmap.config.json", quotas: [[0.8, 1.01, 30], [0.7, 0.8, 35], [0.6, 0.7, 35], [0.5, 0.6, 35], [0.4, 0.5, 35], [0.3, 0.4, 30], [0.2, 0.3, 20]] as const, patterns: 20 },
  { repo: "service-b", sha: "0c0aa958e6b30160639188e78d72114f4f4fa9ea", config: "tools/targets/service-b.dustmap.config.json", quotas: [[0.6, 1.01, 6], [0.4, 0.6, 7], [0.2, 0.4, 7]] as const, patterns: 0 },
];

let seed = 20261021;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

function functionsOf(t: (typeof TARGETS)[number]): Fn[] {
  const root = path.join(repo, ".tmp/targets", `${t.repo}@${t.sha.slice(0, 12)}`, "src");
  const { config } = loadConfig(root, path.join(repo, t.config));
  const inv = takeInventory(root, config, "full");
  const out: Fn[] = [];
  for (const f of inv.files.filter((x) => inv.roles.get(x) === "source")) {
    const text = inv.contents.get(f) ?? "";
    const lines = text.split(/\r?\n/);
    for (const u of extractFunctions(f, text, 20)) {
      const span = lines.slice(u.startLine - 1, u.endLine).join("\n");
      if (u.endLine - u.startLine > 120) continue; // reviewable size
      out.push({ repo: t.repo, sha: t.sha, path: f, startLine: u.startLine, endLine: u.endLine, name: u.name, span, body: u.body });
    }
  }
  return out;
}

const goldSpans = jsonl<{ a: { path: string; startLine: number; endLine: number }; b: { path: string; startLine: number; endLine: number } }>(path.join(repo, "tools/emb/gold/private-refs.jsonl")).flatMap((r) => [r.a, r.b]);
const overlaps = (x: { path: string; startLine: number; endLine: number }, y: { path: string; startLine: number; endLine: number }) => x.path === y.path && x.startLine <= y.endLine && y.startLine <= x.endLine;

async function main(): Promise<void> {
  const provider = await openOnnxProvider({ model: "dustmap-same-meaning-private", device: "auto" });
  const candidates: unknown[] = [];
  try {
    for (const t of TARGETS) {
      const fns = functionsOf(t).filter((f) => !goldSpans.some((g) => overlaps(f, g)));
      const vecs = await provider.embed(fns.map((f) => f.body));
      const dot = (i: number, j: number) => vecs[i]!.reduce((s, x, k) => s + x * vecs[j]![k]!, 0);
      const taken = new Set<string>();
      const pick = (i: number, j: number, band: string) => {
        const [a, b] = [fns[i]!, fns[j]!];
        if (overlaps(a, b) || a.body === b.body) return false;
        const key = [i, j].sort().join(":");
        if (taken.has(key)) return false;
        taken.add(key);
        const ref = (f: Fn) => ({ repo: f.repo, sha: f.sha, path: f.path, startLine: f.startLine, endLine: f.endLine, name: f.name, kind: "function", sha256: createHash("sha256").update(f.span).digest("hex") });
        candidates.push({ id: `real:${t.repo}:${createHash("sha1").update(key + t.repo).digest("hex").slice(0, 10)}`, band, similarity: Number(dot(i, j).toFixed(3)), a: ref(a), b: ref(b), codeA: a.span, codeB: b.span });
        return true;
      };
      for (const [lo, hi, n] of t.quotas) {
        let got = 0;
        for (let tries = 0; got < n && tries < 4000; tries++) {
          const i = Math.floor(rnd() * fns.length);
          const inBand: number[] = [];
          for (let j = 0; j < fns.length; j++) {
            if (j === i) continue;
            const s = dot(i, j);
            if (s >= lo && s < hi) inBand.push(j);
          }
          if (inBand.length && pick(i, inBand[Math.floor(rnd() * inBand.length)]!, `${lo}-${Math.min(hi, 1)}`)) got++;
        }
        console.log(`${t.repo} ${lo}-${hi}: ${got}`);
      }
      let pat = 0;
      for (let tries = 0; pat < t.patterns && tries < 20000; tries++) {
        const i = Math.floor(rnd() * fns.length);
        const j = Math.floor(rnd() * fns.length);
        if (i === j || dot(i, j) < 0.3) continue;
        if (sharedPattern(fns[i]!.body, fns[j]!.body) && pick(i, j, "pattern-rule")) pat++;
      }
      console.log(`${t.repo} pattern-rule: ${pat}`);
    }
  } finally {
    await provider.release();
  }
  mkdirSync(path.join(repo, ".tmp/emb12"), { recursive: true });
  writeFileSync(path.join(repo, ".tmp/emb12/candidates.json"), JSON.stringify(candidates, null, 1));
  console.log(`candidates: ${candidates.length} → .tmp/emb12/candidates.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
