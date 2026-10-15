/**
 * Cache of semantic pairs keyed by sorted function content hashes — second scan with unchanged
 * functions reuses pairs and reports newEmbeddings = 0 (no jscpd / embed work).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SemanticPair } from "./cluster.js";

export type PairCacheFile = {
  modelId: string;
  threshold: number;
  functionHashes: string[];
  pairs: SemanticPair[];
};

export function readPairCache(cacheDir: string): PairCacheFile | null {
  const p = path.join(cacheDir, "pairs.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as PairCacheFile;
  } catch {
    return null;
  }
}

export function writePairCache(cacheDir: string, data: PairCacheFile): void {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(path.join(cacheDir, "pairs.json"), `${JSON.stringify(data)}\n`, "utf8");
}

export function hashesMatch(cached: string[], current: string[]): boolean {
  if (cached.length !== current.length) return false;
  for (let i = 0; i < cached.length; i++) {
    if (cached[i] !== current[i]) return false;
  }
  return true;
}
