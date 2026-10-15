/**
 * Stable finding fingerprint from kind + normalized code snippets + symbol names.
 * Line shifts must not change the hash; content or kind changes must.
 */
import { createHash } from "node:crypto";
import type { FindingKind } from "./finding.js";

/** Strip line comments, block comments, and all whitespace for hashing. */
export function normalizeSnippet(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n");
  // Block comments first so nested // inside blocks disappear with them.
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  // Optional hash comments (rare in TS, harmless for hash stability).
  s = s.replace(/^[ \t]*#[^\n]*/gm, "");
  // Drop standalone line-number prefixes like "42:" that tools sometimes inject.
  s = s.replace(/^[ \t]*\d+[ \t]*:/gm, "");
  return s.replace(/\s+/g, "");
}

/**
 * @param kind finding kind (part of the hash input)
 * @param snippets raw code slices; normalized internally; order does not matter
 * @param symbolNames symbol names; order does not matter
 * @returns first 16 hex chars of sha256
 */
export function fingerprint(
  kind: FindingKind,
  snippets: readonly string[],
  symbolNames: readonly string[],
): string {
  const normalized = snippets.map(normalizeSnippet).filter((s) => s.length > 0).sort();
  const symbols = [...symbolNames].map((n) => n.trim()).filter(Boolean).sort();
  const payload = JSON.stringify({ kind, snippets: normalized, symbols });
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 16);
}
