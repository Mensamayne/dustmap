/**
 * Hard response-size cap and report-freshness warnings for MCP tool replies.
 * Agents must never get an unbounded JSON wall; stale reports are always labeled.
 */

export const DEFAULT_MAX_RESPONSE_BYTES = 32 * 1024;

export const TRUNCATION_NOTE =
  "truncated: response exceeded size limit; use pagination (offset/limit) or dustmap_show for one finding";

export type LimitedText = {
  text: string;
  truncated: boolean;
  bytes: number;
};

/** UTF-8 byte length of a string. */
export function utf8Bytes(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

/**
 * Serialize `value` to pretty JSON and enforce a hard byte cap.
 * When over the limit, cuts the text and appends an explicit truncation note.
 */
export function applyResponseLimit(
  value: unknown,
  maxBytes: number = DEFAULT_MAX_RESPONSE_BYTES,
): LimitedText {
  if (maxBytes < 64) {
    throw new Error(`maxResponseBytes must be at least 64 (got ${maxBytes})`);
  }
  const full = JSON.stringify(value, null, 2);
  const bytes = utf8Bytes(full);
  if (bytes <= maxBytes) {
    return { text: full, truncated: false, bytes };
  }

  const marker = `\n…[${TRUNCATION_NOTE}]`;
  const markerBytes = utf8Bytes(marker);
  const budget = Math.max(0, maxBytes - markerBytes);
  const sliced = Buffer.from(full, "utf8").subarray(0, budget).toString("utf8");
  const text = `${sliced}${marker}`;
  return { text, truncated: true, bytes: utf8Bytes(text) };
}

/**
 * When report.scan.commit ≠ current HEAD, every tool reply should warn the agent.
 * Returns null when HEAD is unknown or matches.
 */
export function reportStaleWarning(
  reportCommit: string,
  head: string | null,
): string | null {
  if (head === null) return null;
  if (reportCommit === head) return null;
  return (
    `Report is stale: report commit ${reportCommit.slice(0, 12)} ≠ HEAD ${head.slice(0, 12)}. ` +
    `Run dustmap_scan (diff by default) to refresh.`
  );
}
