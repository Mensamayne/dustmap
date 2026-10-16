/**
 * Baseline ratchet — block only new findings above a confidence floor.
 */
export {
  BASELINE_FILE,
  BASELINE_SCHEMA_ID,
  BaselineFile,
  baselinePath,
  loadBaseline,
  saveBaseline,
} from "./baseline.js";
export type { BaselineFile as BaselineFileType } from "./baseline.js";
export {
  DEFAULT_RATCHET_OPTIONS,
  parseRatchetOptions,
  meetsConfidenceFloor,
  checkRatchet,
  checkRatchetAt,
  updateBaseline,
} from "./check.js";
export type { RatchetOptions, RatchetResult } from "./check.js";
