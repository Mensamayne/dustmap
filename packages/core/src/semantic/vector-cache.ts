/**
 * Disk cache of embedding vectors keyed by model id + content hash. Lives under outputDir so
 * re-scans only embed changed functions. Binary: `vectors.bin` holds float32 rows, `vectors.index.json`
 * the model id, dimension and content hash of each row — 4 bytes per number instead of ~18 in JSON
 * (22k functions × 768 dims: 68 MB instead of 309 MB) and no parse cost. Exact values are kept.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { EmbeddingProvider } from "./provider.js";

export type VectorCache = {
  get: (contentHash: string) => number[] | undefined;
  put: (contentHash: string, vector: number[]) => void;
  /** Embed texts for entries missing from cache; returns vectors aligned with `items`. */
  embedMissing: (
    items: readonly { contentHash: string; text: string }[],
    provider: EmbeddingProvider,
  ) => Promise<{ vectors: number[][]; newEmbeddings: number }>;
  flush: () => void;
};

type IndexFile = { modelId: string; dims: number; hashes: string[] };

export function openVectorCache(cacheDir: string, modelId: string): VectorCache {
  mkdirSync(cacheDir, { recursive: true });
  const indexPath = path.join(cacheDir, "vectors.index.json");
  const binPath = path.join(cacheDir, "vectors.bin");
  // The JSON format before EMB-08 is never read again; drop it so it does not linger at hundreds of MB.
  rmSync(path.join(cacheDir, "vectors.json"), { force: true });

  const vectors = new Map<string, Float32Array>();
  if (existsSync(indexPath) && existsSync(binPath)) {
    try {
      const index = JSON.parse(readFileSync(indexPath, "utf8")) as IndexFile;
      const buf = readFileSync(binPath);
      if (index.modelId === modelId && buf.byteLength === index.hashes.length * index.dims * 4) {
        const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
        index.hashes.forEach((h, row) => vectors.set(h, all.slice(row * index.dims, (row + 1) * index.dims)));
      }
    } catch {
      vectors.clear();
    }
  }
  let dirty = false;

  const put = (contentHash: string, vector: number[]) => {
    vectors.set(contentHash, Float32Array.from(vector));
    dirty = true;
  };

  return {
    get(contentHash) {
      const v = vectors.get(contentHash);
      return v ? Array.from(v) : undefined;
    },
    put,
    async embedMissing(items, provider) {
      const out: number[][] = new Array(items.length);
      const missingIdx: number[] = [];
      const missingTexts: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const hit = vectors.get(items[i]!.contentHash);
        if (hit) out[i] = Array.from(hit);
        else {
          missingIdx.push(i);
          missingTexts.push(items[i]!.text);
        }
      }
      if (missingTexts.length) {
        const embedded = await provider.embed(missingTexts);
        for (let j = 0; j < missingIdx.length; j++) {
          const vi = missingIdx[j]!;
          const vec = embedded[j]!;
          out[vi] = vec;
          put(items[vi]!.contentHash, vec);
        }
      }
      return { vectors: out, newEmbeddings: missingTexts.length };
    },
    flush() {
      if (!dirty) return;
      const hashes = [...vectors.keys()];
      const dims = hashes.length ? vectors.get(hashes[0]!)!.length : 0;
      const bin = new Float32Array(hashes.length * dims);
      hashes.forEach((h, row) => bin.set(vectors.get(h)!, row * dims));
      writeFileSync(binPath, Buffer.from(bin.buffer, bin.byteOffset, bin.byteLength));
      writeFileSync(indexPath, `${JSON.stringify({ modelId, dims, hashes } satisfies IndexFile)}\n`, "utf8");
      dirty = false;
    },
  };
}
