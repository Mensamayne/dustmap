/**
 * Public surface of @dustmap/contract — Zod schemas, fingerprint, decisions, SARIF mapping.
 */
export {
  Confidence,
  Evidence,
  Finding,
  FindingCategory,
  FindingKind,
  Location,
  SuggestedAction,
} from "./finding.js";
export type {
  Confidence as ConfidenceType,
  Evidence as EvidenceType,
  Finding as FindingType,
  FindingCategory as FindingCategoryType,
  FindingKind as FindingKindType,
  Location as LocationType,
  SuggestedAction as SuggestedActionType,
} from "./finding.js";

export { fingerprint, normalizeSnippet } from "./fingerprint.js";

export {
  CategoryCounts,
  REPORT_SCHEMA_ID,
  Report,
  ReportSummary,
  ScanMeta,
  ScanMode,
  ScanTool,
  TopPlace,
} from "./report.js";
export type {
  CategoryCounts as CategoryCountsType,
  Report as ReportType,
  ReportSummary as ReportSummaryType,
  ScanMeta as ScanMetaType,
  ScanMode as ScanModeType,
  ScanTool as ScanToolType,
  TopPlace as TopPlaceType,
} from "./report.js";

export { Decision, DecisionFile, DecisionVerdict } from "./decisions.js";
export type {
  Decision as DecisionType,
  DecisionFile as DecisionFileType,
  DecisionVerdict as DecisionVerdictType,
} from "./decisions.js";

export { SARIF_SCHEMA_URI, confidenceToSarifLevel, toSarif } from "./sarif.js";
export type { SarifLevel, SarifLog } from "./sarif.js";

export { RepoRelativePath } from "./paths.js";
export type { RepoRelativePath as RepoRelativePathType } from "./paths.js";
