/**
 * Extract function/method bodies from TS/JS sources for embedding. Heuristic brace matcher —
 * good enough for duplicate detection, not a full parser. Skips tiny functions below minTokens.
 */
import { createHash } from "node:crypto";

export type ExtractedFunction = {
  path: string;
  name: string;
  startLine: number;
  endLine: number;
  /** Body without leading/trailing blank lines; comments stripped for hashing/embed. */
  body: string;
  contentHash: string;
};

const FN_START =
  /^[ \t]*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(|^[ \t]*(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/;

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function approxTokens(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function findMatchingBrace(src: string, openIdx: number): number {
  let depth = 0;
  let inStr: string | null = null;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i]!;
    const prev = src[i - 1];
    if (inStr) {
      if (ch === inStr && prev !== "\\") inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inStr = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function lineAt(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) {
    if (src[i] === "\n") line++;
  }
  return line;
}

/** Extract functions from one file. `minTokens` approximates jscpd's token floor. */
export function extractFunctions(
  path: string,
  source: string,
  minTokens: number,
): ExtractedFunction[] {
  const out: ExtractedFunction[] = [];
  const lines = source.split(/\r?\n/);
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!;
    const m = FN_START.exec(line);
    if (!m) continue;
    const name = m[1] ?? m[2] ?? "anonymous";
    // Find `{` on this or following lines
    let abs = 0;
    for (let i = 0; i < li; i++) abs += lines[i]!.length + 1;
    const fromLine = source.slice(abs);
    const braceRel = fromLine.indexOf("{");
    if (braceRel < 0) continue;
    const braceAbs = abs + braceRel;
    const endAbs = findMatchingBrace(source, braceAbs);
    if (endAbs < 0) continue;
    const raw = source.slice(abs, endAbs + 1);
    const body = stripComments(raw).trim();
    if (approxTokens(body) < minTokens) continue;
    const contentHash = createHash("sha256").update(body, "utf8").digest("hex").slice(0, 32);
    out.push({
      path,
      name,
      startLine: li + 1,
      endLine: lineAt(source, endAbs),
      body,
      contentHash,
    });
  }
  return out;
}
