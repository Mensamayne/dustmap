/**
 * falsegreen adapter public surface for the builtin registry.
 */
export {
  falsegreenAdapter,
  runFalsegreenAdapter,
  runFalsegreenJson,
  selectFalsegreenFiles,
  resolveFalsegreenPath,
  materializeFileTree,
} from "./run.js";
export {
  normalizeFalsegreenReport,
  parseFalsegreenOptions,
  pathHasTmpSegment,
  DEFAULT_ALLOW_CODES,
} from "./normalize.js";
