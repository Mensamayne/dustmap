/**
 * Load dustmap.config.json from the scanned repo or an explicit --config path.
 * Missing file → defaults. Invalid keys → readable field errors.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { DustmapConfig, formatConfigError } from "./schema.js";

export type LoadConfigResult = {
  config: DustmapConfig;
  /** Absolute path of the config file when one was read; null when defaults. */
  configPath: string | null;
};

export function defaultConfig(): DustmapConfig {
  return DustmapConfig.parse({});
}

/**
 * @param repoRoot absolute path of the scanned repository
 * @param configPath optional absolute or relative path to a config file (may be outside repo)
 */
export function loadConfig(repoRoot: string, configPath?: string): LoadConfigResult {
  const resolved = configPath
    ? path.resolve(configPath)
    : path.join(repoRoot, "dustmap.config.json");

  if (!existsSync(resolved)) {
    if (configPath) {
      throw new Error(`Config file not found: ${resolved}`);
    }
    return { config: defaultConfig(), configPath: null };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(resolved, "utf8"));
  } catch (err) {
    throw new Error(`Config is not valid JSON (${resolved}): ${String(err)}`);
  }

  const parsed = DustmapConfig.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid dustmap config (${resolved}): ${formatConfigError(parsed.error)}`);
  }
  return { config: parsed.data, configPath: resolved };
}

/** Resolve outputDir to an absolute path (may be outside the scanned repo). */
export function resolveOutputDir(repoRoot: string, outputDir: string): string {
  return path.isAbsolute(outputDir) ? path.normalize(outputDir) : path.resolve(repoRoot, outputDir);
}
