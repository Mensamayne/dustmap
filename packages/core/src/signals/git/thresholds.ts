/**
 * Tunables for git-history signals. Overridable via adapters["git-signals"].options.
 */

export type GitSignalThresholds = {
  /** How far back to read history (git --since), e.g. "6 months ago". */
  since: string;
  /** Commits touching more than this many paths are skipped (mass format/reformat). */
  massCommitFileLimit: number;
  /** Minimum co-change support (shared commits). */
  coChangeMinSupport: number;
  /** Minimum co-change confidence percent (shared / commits touching either). */
  coChangeMinConfidencePct: number;
  /** Minimum hotspot score (changes × max cyclomatic) to report. */
  hotspotMinScore: number;
  /** Minimum fix-density ratio (0–1) to report. */
  fixDensityMinRatio: number;
  /** Minimum commits touching a file before fix-density is considered. */
  fixDensityMinCommits: number;
  /** Regex source for fix-like subjects (case-insensitive). */
  fixSubjectPattern: string;
};

export const DEFAULT_GIT_SIGNAL_THRESHOLDS: GitSignalThresholds = {
  since: "6 months ago",
  massCommitFileLimit: 40,
  coChangeMinSupport: 5,
  coChangeMinConfidencePct: 60,
  hotspotMinScore: 40,
  fixDensityMinRatio: 0.4,
  fixDensityMinCommits: 5,
  fixSubjectPattern: "(^fix(\\(|:|\\/)|^bugfix|^hotfix|\\bfix\\b|\\bbug\\b|\\bhotfix\\b)",
};

function str(raw: unknown, fallback: string): string {
  return typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
}

function num(raw: unknown, fallback: number): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function parseGitSignalThresholds(
  raw: Record<string, unknown> | undefined,
): GitSignalThresholds {
  const src = raw ?? {};
  return {
    since: str(src.since, DEFAULT_GIT_SIGNAL_THRESHOLDS.since),
    massCommitFileLimit: num(src.massCommitFileLimit, DEFAULT_GIT_SIGNAL_THRESHOLDS.massCommitFileLimit),
    coChangeMinSupport: num(src.coChangeMinSupport, DEFAULT_GIT_SIGNAL_THRESHOLDS.coChangeMinSupport),
    coChangeMinConfidencePct: num(
      src.coChangeMinConfidencePct,
      DEFAULT_GIT_SIGNAL_THRESHOLDS.coChangeMinConfidencePct,
    ),
    hotspotMinScore: num(src.hotspotMinScore, DEFAULT_GIT_SIGNAL_THRESHOLDS.hotspotMinScore),
    fixDensityMinRatio: num(src.fixDensityMinRatio, DEFAULT_GIT_SIGNAL_THRESHOLDS.fixDensityMinRatio),
    fixDensityMinCommits: num(
      src.fixDensityMinCommits,
      DEFAULT_GIT_SIGNAL_THRESHOLDS.fixDensityMinCommits,
    ),
    fixSubjectPattern: str(src.fixSubjectPattern, DEFAULT_GIT_SIGNAL_THRESHOLDS.fixSubjectPattern),
  };
}
