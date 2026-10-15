/**
 * Public API of @dustmap/core — config, init/detect, adapter port, scan orchestration.
 */
export type { Adapter, AdapterContext, ScanMode } from "./adapter.js";
export { DustmapConfig, AdapterConfig, LayerRule, SemanticConfig, formatConfigError } from "./config/schema.js";
export type { DustmapConfig as DustmapConfigType } from "./config/schema.js";
export { defaultConfig, loadConfig, resolveOutputDir } from "./config/load.js";
export type { LoadConfigResult } from "./config/load.js";
export { detectProject } from "./init/detect.js";
export type { DetectedProject } from "./init/detect.js";
export { runInit } from "./init/run-init.js";
export type { InitResult } from "./init/run-init.js";
export { runScan, snapshotRepoPaths, isOutsideRepo } from "./scan/run-scan.js";
export type { RunScanOptions, RunScanResult } from "./scan/run-scan.js";
export { collectFiles } from "./scan/collect-files.js";
export { expandImportNeighbors } from "./scan/import-neighbors.js";
export { toPosix, relativePosix } from "./posix.js";
