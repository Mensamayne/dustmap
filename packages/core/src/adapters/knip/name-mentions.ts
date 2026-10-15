/**
 * Count how often a symbol or file basename appears inside string literals across scanned sources.
 * Mentions are a soft signal that something may be loaded "by name" (dynamic plugins, registries).
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches the needle inside single-, double-, or backtick-quoted string literals (no nested quotes).
 * Conservative: false positives (needle inside a longer string) still correctly lower confidence.
 */
export function countNameMentions(needle: string, fileTexts: Iterable<string>): number {
  const trimmed = needle.trim();
  if (!trimmed) return 0;
  const re = new RegExp(`(['"\`])([^'"\`]*?${escapeRegExp(trimmed)}[^'"\`]*?)\\1`, "g");
  let total = 0;
  for (const text of fileTexts) {
    const matches = text.match(re);
    if (matches) total += matches.length;
  }
  return total;
}

/** Basename without extension — what people usually put in a string when loading by name. */
export function fileStem(repoRelativePosix: string): string {
  const base = repoRelativePosix.split("/").pop() ?? repoRelativePosix;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}
