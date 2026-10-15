/**
 * Drop semantic clusters that are already fully covered by a token clone-cluster (DUST-04).
 * Literal copy-paste should not appear twice under a different kind.
 */
import type { FindingType } from "@dustmap/contract";

function rangesOverlap(
  aStart: number | undefined,
  aEnd: number | undefined,
  bStart: number | undefined,
  bEnd: number | undefined,
): boolean {
  const a0 = aStart ?? 1;
  const a1 = aEnd ?? a0;
  const b0 = bStart ?? 1;
  const b1 = bEnd ?? b0;
  return a0 <= b1 && b0 <= a1;
}

/** True when every semantic location sits inside some location of the clone finding. */
export function isFullyCoveredByClone(
  semantic: FindingType,
  clone: FindingType,
): boolean {
  if (clone.kind !== "clone-cluster") return false;
  return semantic.locations.every((sl) =>
    clone.locations.some(
      (cl) => cl.path === sl.path && rangesOverlap(sl.startLine, sl.endLine, cl.startLine, cl.endLine),
    ),
  );
}

/** Remove semantic-cluster findings wholly covered by any clone-cluster in `all`. */
export function dedupeSemanticAgainstClones(all: readonly FindingType[]): FindingType[] {
  const clones = all.filter((f) => f.kind === "clone-cluster");
  if (clones.length === 0) return [...all];
  return all.filter((f) => {
    if (f.kind !== "semantic-cluster") return true;
    return !clones.some((c) => isFullyCoveredByClone(f, c));
  });
}
