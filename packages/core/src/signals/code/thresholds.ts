/**
 * Thresholds for code-signal findings. Overridable via adapters.signals.options; defaults are
 * deliberately boring so a clean codebase stays quiet.
 */

export type CodeSignalThresholds = {
  /** Cyclomatic complexity at or above this → complexity finding. */
  cyclomatic: number;
  /** Cognitive complexity at or above this → complexity finding. */
  cognitive: number;
  /** Max nesting depth (0 = top-level body) at or above → complexity finding. */
  maxNesting: number;
  /** Function body line count at or above → complexity finding. */
  maxFunctionLines: number;
  /** Parameter count at or above → long-parameter-list. */
  maxParams: number;
  /** Boolean-typed parameter count at or above → boolean-params. */
  maxBooleanParams: number;
  /** File line count at or above → large-file. */
  maxFileLines: number;
  /** Distinct files sharing a normalized condition → repeated-condition. */
  repeatedConditionMinFiles: number;
};

export const DEFAULT_CODE_SIGNAL_THRESHOLDS: CodeSignalThresholds = {
  cyclomatic: 20,
  cognitive: 25,
  maxNesting: 5,
  maxFunctionLines: 120,
  maxParams: 7,
  maxBooleanParams: 3,
  maxFileLines: 600,
  repeatedConditionMinFiles: 5,
};

function num(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function parseCodeSignalThresholds(
  raw: Record<string, unknown> | undefined,
): CodeSignalThresholds {
  const src = raw ?? {};
  return {
    cyclomatic: num(src.cyclomatic, DEFAULT_CODE_SIGNAL_THRESHOLDS.cyclomatic),
    cognitive: num(src.cognitive, DEFAULT_CODE_SIGNAL_THRESHOLDS.cognitive),
    maxNesting: num(src.maxNesting, DEFAULT_CODE_SIGNAL_THRESHOLDS.maxNesting),
    maxFunctionLines: num(src.maxFunctionLines, DEFAULT_CODE_SIGNAL_THRESHOLDS.maxFunctionLines),
    maxParams: num(src.maxParams, DEFAULT_CODE_SIGNAL_THRESHOLDS.maxParams),
    maxBooleanParams: num(src.maxBooleanParams, DEFAULT_CODE_SIGNAL_THRESHOLDS.maxBooleanParams),
    maxFileLines: num(src.maxFileLines, DEFAULT_CODE_SIGNAL_THRESHOLDS.maxFileLines),
    repeatedConditionMinFiles: num(
      src.repeatedConditionMinFiles,
      DEFAULT_CODE_SIGNAL_THRESHOLDS.repeatedConditionMinFiles,
    ),
  };
}
