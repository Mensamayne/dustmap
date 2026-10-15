/**
 * `dustmap init` — write dustmap.config.json when missing. Never overwrites an existing config.
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defaultConfig, loadConfig } from "../config/load.js";
import type { DustmapConfig } from "../config/schema.js";
import { detectProject } from "./detect.js";

export type InitResult = {
  wrote: boolean;
  configPath: string;
  config: DustmapConfig;
  detected: ReturnType<typeof detectProject>;
};

export function runInit(repoRoot: string): InitResult {
  const configPath = path.join(repoRoot, "dustmap.config.json");
  const detected = detectProject(repoRoot);

  if (existsSync(configPath)) {
    const { config } = loadConfig(repoRoot);
    return {
      wrote: false,
      configPath,
      config,
      detected,
    };
  }

  const config: DustmapConfig = {
    ...defaultConfig(),
    entryPoints: detected.entryPoints,
  };

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return { wrote: true, configPath, config, detected };
}
