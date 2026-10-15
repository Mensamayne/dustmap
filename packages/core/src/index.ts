/**
 * Public API of @dustmap/core — config, init/detect, adapter port, scan orchestration.
 */
export type { Adapter, AdapterContext, ScanMode } from "./adapter.js";
export { builtinAdapters } from "./adapters/index.js";
export { DustmapConfig, AdapterConfig, LayerRule, SemanticConfig, formatConfigError } from "./config/schema.js";
export type { DustmapConfig as DustmapConfigType } from "./config/schema.js";
export { defaultConfig, loadConfig, resolveOutputDir } from "./config/load.js";
export type { LoadConfigResult } from "./config/load.js";
export { detectProject } from "./init/detect.js";
export type { DetectedProject, UnresolvedEntryPoint } from "./init/detect.js";
export { runInit } from "./init/run-init.js";
export type { InitResult } from "./init/run-init.js";
export { runScan, snapshotRepoPaths, isOutsideRepo } from "./scan/run-scan.js";
export type { RunScanOptions, RunScanResult } from "./scan/run-scan.js";
export { collectFiles } from "./scan/collect-files.js";
export { classifyFiles, selectFiles, takeInventory } from "./scan/inventory.js";
export type { ClassifiedFiles, Inventory } from "./scan/inventory.js";
export { expandImportNeighbors } from "./scan/import-neighbors.js";
export { toPosix, relativePosix } from "./posix.js";
export {
  semanticAdapter,
  runSemanticAnalysis,
  dedupeSemanticAgainstClones,
  createEmbeddingProvider,
  createMemoryEmbeddingProvider,
  assertHttpProviderAllowed,
  isLoopbackUrl,
  RemoteEmbeddingsForbiddenError,
} from "./semantic/index.js";
export type { EmbeddingProvider, SemanticRunResult } from "./semantic/index.js";
