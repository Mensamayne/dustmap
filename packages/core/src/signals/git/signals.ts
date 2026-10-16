/**
 * Derive hotspot, co-change, and fix-density findings from a parsed git log + optional complexity.
 */
import { fingerprint, type FindingType } from "@dustmap/contract";
import type { ParsedGitLog } from "./log.js";
import { summarizeTouches } from "./log.js";
import type { GitSignalThresholds } from "./thresholds.js";

const SOURCE = "git-signals";
const REVIEW_HINT = "Review this history signal with the surrounding module; no automatic change suggested.";

export type FileComplexity = {
  /** Max cyclomatic complexity among functions in the file (1 if unknown). */
  maxCyclomatic: number;
};

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

export function buildGitFindings(
  log: ParsedGitLog,
  thresholds: GitSignalThresholds,
  complexityByFile: ReadonlyMap<string, FileComplexity>,
  /** When set, only emit findings that involve these paths (diff mode). */
  focusPaths?: ReadonlySet<string>,
): FindingType[] {
  const fixRe = new RegExp(thresholds.fixSubjectPattern, "i");
  const { changeCount, fixCount, commitsByFile } = summarizeTouches(log, fixRe);
  const findings: FindingType[] = [];

  const inFocus = (path: string) => !focusPaths || focusPaths.has(path);

  // Hotspots: changes × complexity
  for (const [path, changes] of changeCount) {
    if (!inFocus(path)) continue;
    const cx = complexityByFile.get(path)?.maxCyclomatic ?? 1;
    const score = changes * cx;
    if (score < thresholds.hotspotMinScore) continue;
    const fp = fingerprint("hotspot", [`changes:${changes}`, `cx:${cx}`, path], [path]);
    findings.push({
      fingerprint: fp,
      kind: "hotspot",
      category: "refactor-signal",
      locations: [{ path }],
      evidence: [
        { label: "changes", value: String(changes) },
        { label: "complexity", value: String(cx) },
        { label: "score", value: String(score) },
      ],
      confidence: score >= thresholds.hotspotMinScore * 3 ? "high" : score >= thresholds.hotspotMinScore * 1.5 ? "medium" : "low",
      suggestedAction: "review",
      verifyHint: REVIEW_HINT,
      source: SOURCE,
    });
  }

  // Co-change pairs (count on full commits; filter to focus paths when emitting)
  const pairSupport = new Map<string, number>();
  for (const c of log.commits) {
    const files = c.files;
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const a = files[i]!;
        const b = files[j]!;
        const k = pairKey(a, b);
        pairSupport.set(k, (pairSupport.get(k) ?? 0) + 1);
      }
    }
  }

  for (const [k, support] of pairSupport) {
    if (support < thresholds.coChangeMinSupport) continue;
    const [a, b] = k.split("\0") as [string, string];
    if (focusPaths && !focusPaths.has(a) && !focusPaths.has(b)) continue;
    const setA = commitsByFile.get(a) ?? new Set();
    const setB = commitsByFile.get(b) ?? new Set();
    const union = new Set([...setA, ...setB]);
    const confidencePct = union.size === 0 ? 0 : Math.round((support / union.size) * 100);
    if (confidencePct < thresholds.coChangeMinConfidencePct) continue;
    const fp = fingerprint("co-change", [`support:${support}`, a, b], [a, b]);
    findings.push({
      fingerprint: fp,
      kind: "co-change",
      category: "refactor-signal",
      locations: [{ path: a }, { path: b }],
      evidence: [
        { label: "shared-commits", value: String(support) },
        { label: "confidence", value: `${confidencePct}%` },
        {
          label: "summary",
          value: `${confidencePct}% shared changes (${support} commits together)`,
        },
      ],
      confidence: confidencePct >= 80 ? "high" : confidencePct >= 60 ? "medium" : "low",
      suggestedAction: "review",
      verifyHint: REVIEW_HINT,
      source: SOURCE,
    });
  }

  // Fix density
  for (const [path, changes] of changeCount) {
    if (!inFocus(path)) continue;
    if (changes < thresholds.fixDensityMinCommits) continue;
    const fixes = fixCount.get(path) ?? 0;
    const ratio = fixes / changes;
    if (ratio < thresholds.fixDensityMinRatio) continue;
    const fp = fingerprint("fix-density", [`fixes:${fixes}`, `changes:${changes}`, path], [path]);
    findings.push({
      fingerprint: fp,
      kind: "fix-density",
      category: "refactor-signal",
      locations: [{ path }],
      evidence: [
        { label: "fix-commits", value: String(fixes) },
        { label: "changes", value: String(changes) },
        { label: "fix-ratio", value: ratio.toFixed(2) },
      ],
      confidence: ratio >= 0.7 ? "high" : ratio >= 0.5 ? "medium" : "low",
      suggestedAction: "review",
      verifyHint: REVIEW_HINT,
      source: SOURCE,
    });
  }

  return findings.sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}
