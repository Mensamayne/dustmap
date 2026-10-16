/**
 * Git history signals — hotspots, co-changes, fix density.
 */
export { readGitLog, parseNumstatLog, summarizeTouches, type ParsedGitLog, type GitCommitTouch } from "./log.js";
export { buildGitFindings, type FileComplexity } from "./signals.js";
export { loadGitLogCached, seedGitLogCache, gitLogCachePath } from "./diff-mode.js";
export {
  parseGitSignalThresholds,
  DEFAULT_GIT_SIGNAL_THRESHOLDS,
  type GitSignalThresholds,
} from "./thresholds.js";
export { gitSignalsAdapter, runGitSignals, gitSignalsLastStats } from "./run.js";
