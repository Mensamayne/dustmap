/**
 * Disk cache of embedding vectors keyed by model id + content hash. Lives under outputDir so
 * re-scans only embed changed functions.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

type StoreFile = {
  modelId: string;
  vectors: Record<string, number[]>;
};

export function openVectorCache(cacheDir: string, modelId: string): VectorCache {
  mkdirSync(cacheDir, { recursive: true });
  const filePath = path.join(cacheDir, "vectors.json");
  let store: StoreFile = { modelId, vectors: {} };
  if (existsSync(filePath)) {
    try {
      const raw = JSON.parse(readFileSync(filePath, "utf8")) as StoreFile;
      if (raw.modelId === modelId && raw.vectors && typeof raw.vectors === "object") {
        store = raw;
      }
    } catch {
      store = { modelId, vectors: {} };
    }
  }

  return {
    get(contentHash) {
      return store.vectors[contentHash];
    },
    put(contentHash, vector) {
      store.vectors[contentHash] = vector;
    },
    async embedMissing(items, provider) {
      const vectors: number[][] = new Array(items.length);
      const missingIdx: number[] = [];
      const missingTexts: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const hit = store.vectors[items[i]!.contentHash];
        if (hit) vectors[i] = hit;
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
          vectors[vi] = vec;
          store.vectors[items[vi]!.contentHash] = vec;
        }
      }
      return { vectors: vectors as number[][], newEmbeddings: missingTexts.length };
    },
    flush() {
      writeFileSync(filePath, `${JSON.stringify(store)}\n`, "utf8");
    },
  };
}
