/**
 * Adapter port — scanners and signal extractors implement this; core never parses their raw JSON.
 */
import type { FileRoleType, FindingType } from "@dustmap/contract";
import type { DustmapConfig } from "./config/schema.js";
import type { OpenedJudge } from "./judge/judge.js";

export type ScanMode = "full" | "diff";

export type AdapterContext = {
  repoRoot: string;
  /** Every scanned script file (TS/JS), POSIX paths relative to repoRoot, whatever its role. */
  files: readonly string[];
  /** What each scanned file is (DUST-20). */
  roles: ReadonlyMap<string, FileRoleType>;
  /** Scanned script files with one of the given roles; detectors default to `filesWithRole("source")`. */
  filesWithRole: (...roles: FileRoleType[]) => string[];
  /**
   * Scanned stylesheets (.css / .scss) with one of the given roles (DUP-01). Kept apart from `files`
   * so script detectors never parse CSS; absent in contexts built without a style inventory.
   */
  styleFilesWithRole?: (...roles: FileRoleType[]) => string[];
  config: DustmapConfig;
  mode: ScanMode;
  readFile: (repoRelativePosix: string) => Promise<string>;
  /**
   * The scan's pair judge (V1-01), opened once on first use and released by the scan. Absent in contexts
   * built outside a scan; an adapter then opens its own from `config.judge`.
   */
  judge?: () => Promise<OpenedJudge>;
};

export type Adapter = {
  name: string;
  /** Cache key of the adapter's results: change it whenever the same files could give other findings (code, models, settings). */
  version: (config: DustmapConfig) => string;
  run: (ctx: AdapterContext) => Promise<FindingType[]>;
};
