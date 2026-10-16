/**
 * Disk cache of judge verdicts keyed by fingerprint + model id under outputDir/cache/judge.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Judgement, type JudgementType } from "@dustmap/contract";

export function judgeCacheDir(outputDir: string): string {
  return path.join(outputDir, "cache", "judge");
}

function cacheFile(outputDir: string, fingerprint: string, modelId: string): string {
  const safeModel = modelId.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 64);
  return path.join(judgeCacheDir(outputDir), `${fingerprint}@${safeModel}.json`);
}

export function readJudgeCache(
  outputDir: string,
  fingerprint: string,
  modelId: string,
): JudgementType | undefined {
  const file = cacheFile(outputDir, fingerprint, modelId);
  if (!existsSync(file)) return undefined;
  try {
    return Judgement.parse(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return undefined;
  }
}

export function writeJudgeCache(
  outputDir: string,
  fingerprint: string,
  judgement: JudgementType,
): void {
  mkdirSync(judgeCacheDir(outputDir), { recursive: true });
  const file = cacheFile(outputDir, fingerprint, judgement.model);
  writeFileSync(file, `${JSON.stringify(judgement, null, 2)}\n`, "utf8");
}
