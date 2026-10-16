/**
 * Optional LLM judge — annotate duplicate clusters and top places; default off.
 */
export {
  annotateWithJudge,
} from "./annotate.js";
export type { AnnotateJudgeOptions } from "./annotate.js";
export {
  assertJudgeReady,
  createJudgeProvider,
  createRecordingJudgeProvider,
  JudgeConfigError,
  JudgeRemoteForbiddenError,
} from "./provider.js";
export type { JudgeProvider } from "./provider.js";
export { readJudgeCache, writeJudgeCache, judgeCacheDir } from "./cache.js";
