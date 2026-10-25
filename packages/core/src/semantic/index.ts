/**
 * Semantic duplicate detection — providers, clustering, clone dedupe, and the scan adapter.
 */
export {
  createEmbeddingProvider,
  createMemoryEmbeddingProvider,
  createOpenAiCompatibleProvider,
  assertHttpProviderAllowed,
  isLoopbackUrl,
  RemoteEmbeddingsForbiddenError,
  SemanticProviderConfigError,
  type EmbeddingProvider,
} from "./provider.js";
export {
  clusterSemanticPairs,
  pairsAboveThreshold,
  cosineSimilarity,
  isNestedSpanPair,
  type SemanticPair,
  type SemanticFunctionRef,
} from "./cluster.js";
export { extractFunctions, stripComments, type ExtractedFunction } from "./extract.js";
export { extractUnits, fragmentWindows, type CodeUnit, type ExtractUnitsOptions, type UnitKind, type UnitMemberRef } from "./units.js";
export { confidenceFor, lowerConfidence, reportFloor, sharedPattern, type Calibration, type Confidence } from "./calibration.js";
export {
  PAIR_HEAD_CLASSES,
  mapGoldLabelToPairClass,
  pairClassIndex,
  pairFeatures,
  cosinePairBaseline,
  openPairHeadSession,
  type PairHeadClass,
  type PairHeadScores,
  type PairHeadSession,
  type GoldLikeLabel,
} from "./pair-head.js";

export {
  loadModelPackage,
  openOnnxProvider,
  resolveModelDir,
  OnnxModelError,
  type ModelManifest,
  type OnnxProvider,
} from "./onnx-provider.js";
export {
  runSemanticAnalysis,
  runSemanticAdapter,
  semanticAdapter,
  type SemanticRunResult,
  type SemanticRunStats,
} from "./run.js";
