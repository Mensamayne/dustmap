/**
 * Public API of @dustmap/core — config, init/detect, adapter port, scan orchestration.
 */
export type { Adapter, AdapterContext, ScanMode } from "./adapter.js";
export { builtinAdapters } from "./adapters/index.js";
export {
  DustmapConfig,
  AdapterConfig,
  LayerRule,
  SemanticConfig,
  RankingConfig,
  RatchetConfig,
  JudgeConfig,
  BriefsSinkConfig,
  BriefsSinkDefaults,
  SinksConfig,
  formatConfigError,
} from "./config/schema.js";
export type {
  DustmapConfig as DustmapConfigType,
  BriefsSinkConfig as BriefsSinkConfigType,
  SinksConfig as SinksConfigType,
} from "./config/schema.js";
export { defaultConfig, loadConfig, resolveOutputDir } from "./config/load.js";
export type { LoadConfigResult } from "./config/load.js";
export { detectProject } from "./init/detect.js";
export type { DetectedProject, UnresolvedEntryPoint } from "./init/detect.js";
export { runInit } from "./init/run-init.js";
export type { InitResult } from "./init/run-init.js";
export { runScan, snapshotRepoPaths, isOutsideRepo } from "./scan/run-scan.js";
export { UnknownBaseRefError } from "./scan/git.js";
export { UserInputError } from "./user-input-error.js";
export {
  REPORT_FILES,
  REPORT_KINDS,
  reportFilePath,
  isReportKind,
  loadReportFile,
  readScanTarget,
  SCAN_TARGET_FILE,
} from "./scan/report-file.js";
export type { ReportKind } from "./scan/report-file.js";
export { listFindings, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT } from "./report/list.js";
export type { ListFindingsOptions, ListFindingsPage } from "./report/list.js";
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
  createOpenAiCompatibleProvider,
  cosineSimilarity,
  runJscpdSemanticPairs,
  openOnnxProvider,
  loadModelPackage,
  resolveModelDir,
  OnnxModelError,
  confidenceFor,
  lowerConfidence,
  reportFloor,
  sharedPattern,
} from "./semantic/index.js";
export type { EmbeddingProvider, SemanticRunResult, JscpdSemanticOptions, ModelManifest, OnnxProvider, Calibration, Confidence } from "./semantic/index.js";
export {
  codeSignalsAdapter,
  runCodeSignals,
  collectFileMetrics,
  findingIsPrescriptionFree,
} from "./signals/code/index.js";
export {
  gitSignalsAdapter,
  runGitSignals,
  gitSignalsLastStats,
} from "./signals/git/index.js";
export {
  depcruiseAdapter,
  runDepcruise,
  cruiseModuleGraph,
  buildModuleGraph,
  graphNeighbors,
} from "./adapters/depcruise/index.js";
export type { ModuleGraph, ModuleEdge } from "./adapters/depcruise/index.js";
export {
  buildStructureFindings,
  parseStructureThresholds,
} from "./signals/structure/index.js";
export {
  scorePlaces,
  summarizeFindings,
  placeKey,
  parseRankingWeights,
  rankingWeightsFromConfig,
  DEFAULT_RANKING_WEIGHTS,
} from "./rank/index.js";
export type { PlaceScore, RankingWeights } from "./rank/index.js";
export {
  DECISIONS_FILE,
  decisionsPath,
  loadDecisions,
  saveDecisions,
  upsertDecision,
  mutedFingerprints,
  applyDecisions,
} from "./decisions/index.js";
export {
  BASELINE_FILE,
  BASELINE_SCHEMA_ID,
  baselinePath,
  loadBaseline,
  saveBaseline,
  checkRatchet,
  checkRatchetAt,
  updateBaseline,
  parseRatchetOptions,
  DEFAULT_RATCHET_OPTIONS,
} from "./ratchet/index.js";
export type { RatchetOptions, RatchetResult, BaselineFileType } from "./ratchet/index.js";
export {
  annotateWithJudge,
  assertJudgeReady,
  createJudgeProvider,
  createRecordingJudgeProvider,
  JudgeConfigError,
  JudgeRemoteForbiddenError,
} from "./judge/index.js";
export type { JudgeProvider, AnnotateJudgeOptions } from "./judge/index.js";

