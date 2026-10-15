/**
 * Adapter port — scanners and signal extractors implement this; core never parses their raw JSON.
 */
import type { FileRoleType, FindingType } from "@dustmap/contract";
import type { DustmapConfig } from "./config/schema.js";

export type ScanMode = "full" | "diff";

export type AdapterContext = {
  repoRoot: string;
  /** Every scanned file, POSIX paths relative to repoRoot, whatever its role. */
  files: readonly string[];
  /** What each scanned file is (DUST-20). */
  roles: ReadonlyMap<string, FileRoleType>;
  /** Scanned files with one of the given roles; detectors default to `filesWithRole("source")`. */
  filesWithRole: (...roles: FileRoleType[]) => string[];
  config: DustmapConfig;
  mode: ScanMode;
  readFile: (repoRelativePosix: string) => Promise<string>;
};

export type Adapter = {
  name: string;
  version: () => string;
  run: (ctx: AdapterContext) => Promise<FindingType[]>;
};
