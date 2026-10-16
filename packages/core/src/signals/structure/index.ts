/**
 * Structure signals — cycles, hubs, layer violations derived from a ModuleGraph.
 */
export { buildStructureFindings } from "./signals.js";
export { parseStructureThresholds, DEFAULT_STRUCTURE_THRESHOLDS, topPercentCutoff } from "./thresholds.js";
export type { StructureThresholds } from "./thresholds.js";
