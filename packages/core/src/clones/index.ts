/**
 * Duplicates by normalization (DUP-01, layer L1) for the builtin adapter registry.
 */
import type { Adapter } from "../adapter.js";
import { runNormalizedClones } from "./run.js";

/** Bump when the normalization or grouping changes, so cached results are recomputed. */
const VERSION = "1";

export function normalizedClonesAdapter(): Adapter {
  return { name: "normalized", version: () => VERSION, run: runNormalizedClones };
}

export { normalizedUnits, renameMap, literalChanges, type NormalizedUnit } from "./normalize-ts.js";
export { cssRules, ruleKey, duplicationTypes, expandDeclaration, familyOf, type CssRule } from "./normalize-css.js";
export { canonicalColor, normalizeValue } from "./css-values.js";
