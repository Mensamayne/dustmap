/**
 * jscpd copy-paste adapter public surface for the builtin registry.
 */
export { jscpdAdapter, runJscpdAdapter, parseJscpdRunOptions, materializeFileTree } from "./run.js";
export { clusterDuplicates, resolveClonePath } from "./cluster.js";
export {
  parseJscpdNoiseOptions,
  shouldScanForJscpd,
  isImportOnlyFragment,
  isZodSchemaFragment,
  isLowConfidenceCloneFragment,
} from "./noise.js";
