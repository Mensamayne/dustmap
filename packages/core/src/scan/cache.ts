/**
 * Adapter-run cache under outputDir/cache. Keyed by adapter version + content hashes of the file set.
 * A full hit skips Adapter.run entirely.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Finding, type FindingType } from "@dustmap/contract";

export type CacheStats = { hits: number; misses: number };

export type AdapterCache = {
  stats: CacheStats;
  tryGet: (files: readonly string[], contents: ReadonlyMap<string, string>) => FindingType[] | null;
  put: (files: readonly string[], contents: ReadonlyMap<string, string>, findings: FindingType[]) => void;
};

function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function corpusKey(
  adapterName: string,
  adapterVersion: string,
  files: readonly string[],
  contents: ReadonlyMap<string, string>,
): string {
  const lines = files.map((f) => `${f}:${hashText(contents.get(f) ?? "")}`).sort();
  return hashText(`${adapterName}\0${adapterVersion}\0${lines.join("\n")}`);
}

export function openAdapterCache(
  outputDirAbs: string,
  adapterName: string,
  adapterVersion: string,
): AdapterCache {
  const dir = path.join(outputDirAbs, "cache", adapterName);
  mkdirSync(dir, { recursive: true });
  const stats: CacheStats = { hits: 0, misses: 0 };

  return {
    stats,
    tryGet(files, contents) {
      const key = corpusKey(adapterName, adapterVersion, files, contents);
      const p = path.join(dir, `${key}.json`);
      if (!existsSync(p)) {
        stats.misses += Math.max(files.length, 1);
        return null;
      }
      try {
        const raw = JSON.parse(readFileSync(p, "utf8")) as { findings: unknown };
        const findings = Finding.array().parse(raw.findings);
        stats.hits += Math.max(files.length, 1);
        return findings;
      } catch {
        stats.misses += Math.max(files.length, 1);
        return null;
      }
    },
    put(files, contents, findings) {
      const key = corpusKey(adapterName, adapterVersion, files, contents);
      const p = path.join(dir, `${key}.json`);
      writeFileSync(
        p,
        `${JSON.stringify({ version: adapterVersion, findings }, null, 0)}\n`,
        "utf8",
      );
    },
  };
}
