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
  looksLikeConfigFactory,
  type SemanticPair,
  type SemanticFunctionRef,
} from "./cluster.js";
export { extractFunctions, type ExtractedFunction } from "./extract.js";
export { dedupeSemanticAgainstClones, isFullyCoveredByClone } from "./dedupe-vs-clones.js";
export {
  runSemanticAnalysis,
  runSemanticAdapter,
  semanticAdapter,
  type SemanticRunResult,
  type SemanticRunStats,
} from "./run.js";
