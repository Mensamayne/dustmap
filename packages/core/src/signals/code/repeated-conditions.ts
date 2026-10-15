/**
 * Find literal comparisons / case labels repeated across many files — a signal that a decision
 * may lack a single owning module. Normalization strips whitespace and outer parens; identifiers
 * on the left stay (so `x.kind === "sorbet"` keys as `x.kind==="sorbet"`).
 */
import ts from "typescript";

export type ConditionHit = {
  /** Normalized key shared across files. */
  key: string;
  path: string;
  startLine: number;
  /** Short original snippet for evidence. */
  snippet: string;
};

function lineOf(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

/** Literals too generic to mean “a domain decision is scattered”. */
const TRIVIAL_LITERALS = new Set(["null", "undefined", "true", "false", "0", "1", "-1", '""', "''"]);

/** Property names that are structural checks, not domain branching. */
const TRIVIAL_PROPS = new Set(["length", "size", "width", "height", "byteLength"]);

function literalText(node: ts.Expression): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    if (node.text.length < 2) return null;
    return JSON.stringify(node.text);
  }
  if (ts.isNumericLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return "true";
  if (node.kind === ts.SyntaxKind.FalseKeyword) return "false";
  if (node.kind === ts.SyntaxKind.NullKeyword) return "null";
  return null;
}

function isUsefulConditionKey(key: string): boolean {
  if (key.startsWith("typeof")) return false;
  if (key.startsWith("case ")) {
    const lit = key.slice("case ".length);
    return !TRIVIAL_LITERALS.has(lit) && lit.length >= 2;
  }
  const m = /^(.*?)(===|!==|==|!=)(.+)$/.exec(key);
  if (!m) return false;
  const left = m[1]!;
  const lit = m[3]!;
  if (TRIVIAL_LITERALS.has(lit)) return false;
  if (TRIVIAL_PROPS.has(left)) return false;
  // Bare identifiers like `ok===true` already excluded via trivial literals.
  return true;
}

/**
 * Normalize the compared side so `x.kind`, `row.kind`, and bare `kind` share one key when the
 * literal matches — the signal is “this decision about this field+value is scattered”.
 */
function normalizedLeft(node: ts.Expression, sf: ts.SourceFile): string {
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.name)) {
    return node.name.text;
  }
  if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression)) {
    return node.argumentExpression.text;
  }
  return node.getText(sf).replace(/\s+/g, "");
}

function opText(kind: ts.SyntaxKind): string | null {
  switch (kind) {
    case ts.SyntaxKind.EqualsEqualsEqualsToken:
      return "===";
    case ts.SyntaxKind.ExclamationEqualsEqualsToken:
      return "!==";
    case ts.SyntaxKind.EqualsEqualsToken:
      return "==";
    case ts.SyntaxKind.ExclamationEqualsToken:
      return "!=";
    default:
      return null;
  }
}

/** Collect normalized literal comparisons and case labels from one file. */
export function collectConditionHits(repoRelativePosix: string, sourceText: string): ConditionHit[] {
  const sf = ts.createSourceFile(
    repoRelativePosix,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    repoRelativePosix.endsWith(".tsx") || repoRelativePosix.endsWith(".jsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );
  const hits: ConditionHit[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node)) {
      const op = opText(node.operatorToken.kind);
      if (op) {
        const litRight = literalText(node.right);
        const litLeft = literalText(node.left);
        if (litRight !== null) {
          const key = `${normalizedLeft(node.left, sf)}${op}${litRight}`;
          hits.push({
            key,
            path: repoRelativePosix,
            startLine: lineOf(sf, node.getStart(sf)),
            snippet: node.getText(sf).replace(/\s+/g, " ").slice(0, 120),
          });
        } else if (litLeft !== null) {
          const key = `${litLeft}${op}${normalizedLeft(node.right, sf)}`;
          hits.push({
            key,
            path: repoRelativePosix,
            startLine: lineOf(sf, node.getStart(sf)),
            snippet: node.getText(sf).replace(/\s+/g, " ").slice(0, 120),
          });
        }
      }
    }
    if (ts.isCaseClause(node) && node.expression) {
      const lit = literalText(node.expression);
      if (lit !== null) {
        const key = `case ${lit}`;
        hits.push({
          key,
          path: repoRelativePosix,
          startLine: lineOf(sf, node.getStart(sf)),
          snippet: `case ${lit}`,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

export type RepeatedCondition = {
  key: string;
  /** One hit per file (first occurrence). */
  locations: ConditionHit[];
};

/** Group hits by key; keep those present in at least `minFiles` distinct paths. */
export function findRepeatedConditions(
  hits: readonly ConditionHit[],
  minFiles: number,
): RepeatedCondition[] {
  const byKey = new Map<string, ConditionHit[]>();
  for (const h of hits) {
    const list = byKey.get(h.key) ?? [];
    list.push(h);
    byKey.set(h.key, list);
  }
  const out: RepeatedCondition[] = [];
  for (const [key, list] of byKey) {
    if (!isUsefulConditionKey(key)) continue;
    const byPath = new Map<string, ConditionHit>();
    for (const h of list) {
      if (!byPath.has(h.path)) byPath.set(h.path, h);
    }
    if (byPath.size >= minFiles) {
      out.push({
        key,
        locations: [...byPath.values()].sort(
          (a, b) => a.path.localeCompare(b.path) || a.startLine - b.startLine,
        ),
      });
    }
  }
  return out.sort((a, b) => b.locations.length - a.locations.length || a.key.localeCompare(b.key));
}
