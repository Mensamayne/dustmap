/**
 * The pair judge (layer L4): one interface over a model package, an OpenAI-compatible API, the
 * Anthropic API, or none (V1-01).
 */
export { openJudge, groupJudgement, DEFAULT_JUDGE_PACKAGE } from "./judge.js";
export type { PairJudge, JudgedPair, OpenedJudge } from "./judge.js";
export {
  createApiJudge,
  assertApiJudgeReady,
  parsePairVerdict,
  scoreOf,
  judgeApiKey,
  JudgeConfigError,
  JudgeRemoteForbiddenError,
  PAIR_PROMPT,
} from "./llm.js";
export type { ApiJudge } from "./llm.js";
