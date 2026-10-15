/**
 * Adapter port — scanners and signal extractors implement this; core never parses their raw JSON.
 */
import type { FindingType } from "@dustmap/contract";
import type { DustmapConfig } from "./config/schema.js";

export type ScanMode = "full" | "diff";

export type AdapterContext = {
  repoRoot: string;
  /** POSIX paths relative to repoRoot. */
  files: readonly string[];
  config: DustmapConfig;
  mode: ScanMode;
  readFile: (repoRelativePosix: string) => Promise<string>;
};

export type Adapter = {
  name: string;
  version: () => string;
  run: (ctx: AdapterContext) => Promise<FindingType[]>;
};
