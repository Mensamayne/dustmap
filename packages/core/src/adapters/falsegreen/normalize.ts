/**
 * Map falsegreen-js findings onto Dustmap Findings with an allowlist so C16/C8/JS8 noise stays out.
 */
import { fingerprint, type FindingType } from "@dustmap/contract";
import type { FalsegreenFinding, FalsegreenJsonReport } from "./types.js";

/** Default codes that match false-green / weak-oracle shapes (JS8 omitted — pin-test false positives). */
export const DEFAULT_ALLOW_CODES = [
  "C5",
  "C7",
  "C44",
  "JS25",
  "C2",
  "C2b",
  "C6",
  "C11a",
  "JS2",
  "JS27",
] as const;

export type NormalizeFalsegreenOptions = {
  /** Repo-relative POSIX path from an absolute (or temp-tree) path in the tool report. */
  resolvePath: (absoluteOrToolPath: string) => string | null;
  allowCodes?: readonly string[];
  /** When false, drop tool `low` even if the code is allowlisted. Default true. */
  includeLow?: boolean;
  source: string;
};

const VERIFY_HINT =
  "Remove this false-green test and replace it with a pin-gate or real CLI proof of the user intent; do not freeze behaviour with tautologies or mock-only oracles.";

export function parseFalsegreenOptions(raw: Record<string, unknown> | undefined): {
  allowCodes: readonly string[];
  includeLow: boolean;
} {
  const src = raw ?? {};
  const includeLow = src.includeLow === false ? false : true;
  if (Array.isArray(src.allowCodes) && src.allowCodes.every((c) => typeof c === "string")) {
    return { allowCodes: src.allowCodes as string[], includeLow };
  }
  return { allowCodes: DEFAULT_ALLOW_CODES, includeLow };
}

/** True when any path segment is exactly `.tmp` (scratch trees, not project-specific). */
export function pathHasTmpSegment(repoRelativePosix: string): boolean {
  return repoRelativePosix.split("/").includes(".tmp");
}

function testTitle(snippet: string | undefined): string | undefined {
  if (!snippet) return undefined;
  const m = /(?:it|test|describe)\s*\(\s*['"`]([^'"`]+)['"`]/.exec(snippet);
  return m?.[1]?.trim() || undefined;
}

function toFinding(
  raw: FalsegreenFinding,
  repoPath: string,
  source: string,
): FindingType {
  const title = testTitle(raw.snippet);
  const snippetParts = [`${raw.code}:${raw.detail}`, raw.snippet ?? raw.title];
  const symbols = [repoPath, title].filter((s): s is string => Boolean(s));
  const confidence = raw.confidence === "high" ? "high" : "medium";

  return {
    fingerprint: fingerprint("false-green-test", snippetParts, symbols),
    kind: "false-green-test",
    category: "refactor-signal",
    locations: [
      {
        path: repoPath,
        startLine: raw.line > 0 ? raw.line : undefined,
        ...(title ? { symbol: title } : {}),
      },
    ],
    evidence: [
      { label: "code", value: raw.code },
      { label: "detail", value: raw.detail || raw.title },
      { label: "level", value: raw.level || "unit" },
      ...(raw.fix ? [{ label: "fix", value: raw.fix }] : []),
    ],
    confidence,
    suggestedAction: "review",
    verifyHint: VERIFY_HINT,
    source,
  };
}

/**
 * Filter and normalize a falsegreen JSON report. Drops non-allowlisted codes, `.tmp` paths,
 * and (when includeLow is false) tool-low findings.
 */
export function normalizeFalsegreenReport(
  report: FalsegreenJsonReport,
  opts: NormalizeFalsegreenOptions,
): FindingType[] {
  const allow = new Set(opts.allowCodes ?? DEFAULT_ALLOW_CODES);
  const includeLow = opts.includeLow !== false;
  const out: FindingType[] = [];

  for (const raw of report.findings ?? []) {
    if (!allow.has(raw.code)) continue;
    if (raw.confidence === "low" && !includeLow) continue;
    if (raw.confidence !== "high" && raw.confidence !== "low") continue;

    const repoPath = opts.resolvePath(raw.file);
    if (!repoPath || pathHasTmpSegment(repoPath)) continue;

    out.push(toFinding(raw, repoPath, opts.source));
  }

  return out;
}
