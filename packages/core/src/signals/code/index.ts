/**
 * Code spaghetti signals — complexity, large files, parameter smells, repeated conditions.
 */
export { collectFileMetrics, type FileMetrics, type FunctionMetrics } from "./metrics.js";
export {
  collectConditionHits,
  findRepeatedConditions,
  type ConditionHit,
  type RepeatedCondition,
} from "./repeated-conditions.js";
export {
  metricsToFindings,
  repeatedConditionsToFindings,
  findingIsPrescriptionFree,
  assertNoPrescription,
} from "./to-findings.js";
export {
  parseCodeSignalThresholds,
  DEFAULT_CODE_SIGNAL_THRESHOLDS,
  type CodeSignalThresholds,
} from "./thresholds.js";
export { codeSignalsAdapter, runCodeSignals } from "./run.js";
