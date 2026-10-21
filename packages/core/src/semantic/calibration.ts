/**
 * From similarity to report confidence (EMB-09). A model package carries its own bands, computed on
 * the gold set's validation split (tools/emb/calibrate.mts): `high` where ≥ 90% of pairs were real
 * duplicates, `medium` ≥ 75%. The report starts at `medium`: the gold set is ~40% duplicates, so its
 * 50% point sits at near-random similarity (0.05–0.22) and would flood a real repo, where duplicates
 * are a tiny share of all pairs. `low` is what a deliberate pattern found at `medium` becomes. Bands
 * belong to the model, never to the code: another model has another similarity scale.
 *
 * Deliberate patterns get one level less (DUST-15 decision 4), found from the syntax tree only —
 * never from names. Two units (not near copies) share a pattern when:
 *   - both are one top-level call on the same receiver / to the same function with different
 *     arguments (route and event registrations, declaration factories: `x.on(…)`, `define(…)`);
 *   - both bodies are one call to the same callee with a different object-literal config;
 *   - they share the same opening statements and then diverge;
 *   - both bodies are one `switch` over the same discriminant (reducer skeletons);
 *   - both wrap different work in the same `catch` block.
 * Equal signatures alone are no pattern: independent implementations of one job share them.
 */
import ts from "typescript";

export type Confidence = "high" | "medium" | "low";

export type Calibration = {
  /** Lowest similarity of each band; null when the validation split never reached that precision. */
  bands: { high: number | null; medium: number | null; low: number | null };
};

/** Where the report starts for a calibrated model: its `medium` band (else `high`). */
export function reportFloor(cal: Calibration): number | null {
  return cal.bands.medium ?? cal.bands.high;
}

/** Band of a similarity at or above the report floor. */
export function confidenceFor(similarity: number, cal: Calibration): Confidence | null {
  if (cal.bands.high !== null && similarity >= cal.bands.high) return "high";
  const floor = reportFloor(cal);
  return floor !== null && similarity >= floor ? "medium" : null;
}

export function lowerConfidence(c: Confidence): Confidence {
  return c === "high" ? "medium" : "low";
}

type Unit = {
  /** Receiver (`router` of `router.get(…)`) or function (`define` of `define(…)`) of a unit that is one top-level call. */
  topCall: string | null;
  statements: string[];
  callee: string | null;
  switchOn: string | null;
  catchBlock: string | null;
  tokens: Set<string>;
};

const MIN_PREFIX_CHARS = 40;
const MIN_CATCH_CHARS = 30;
const MAX_TAIL_OVERLAP = 0.5;
const NEAR_COPY = 0.85;

const squash = (s: string) => s.replace(/\s+/g, "");
const tokensOf = (s: string) => new Set(s.match(/[A-Za-z_$][\w$]*/g) ?? []);

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
}

function firstFunction(sf: ts.SourceFile): ts.FunctionLikeDeclaration | null {
  let found: ts.FunctionLikeDeclaration | null = null;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isGetAccessorDeclaration(n) || ts.isConstructorDeclaration(n)) && n.body) {
      found = n;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return found;
}

function topCallOf(sf: ts.SourceFile): string | null {
  if (sf.statements.length !== 1) return null;
  const st = sf.statements[0]!;
  let expr: ts.Expression | undefined;
  if (ts.isExpressionStatement(st)) expr = st.expression;
  else if (ts.isVariableStatement(st) && st.declarationList.declarations.length === 1) expr = st.declarationList.declarations[0]!.initializer;
  while (expr && (ts.isAwaitExpression(expr) || ts.isParenthesizedExpression(expr))) expr = expr.expression;
  if (!expr || !ts.isCallExpression(expr) || expr.arguments.length === 0) return null;
  const callee = expr.expression;
  return squash((ts.isPropertyAccessExpression(callee) ? callee.expression : callee).getText(sf));
}

function unitOf(code: string): Unit | null {
  // Members cut out of a class / object are not valid on their own: try as is, then wrapped.
  for (const text of [code, `class __W {
${code}
}`, `const __w = {
${code}
};`]) {
    const sf = ts.createSourceFile("unit.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    if ((sf as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics.length) continue;
    const topCall = text === code ? topCallOf(sf) : null;
    const fn = firstFunction(sf);
    if (!fn?.body && !topCall) continue;
    const body = fn?.body;
    const statements = body && ts.isBlock(body) ? body.statements.map((s) => squash(s.getText(sf))) : [];
    let expr: ts.Expression | undefined;
    if (body && ts.isBlock(body)) {
      const only = body.statements.length === 1 ? body.statements[0] : undefined;
      if (only && (ts.isReturnStatement(only) || ts.isExpressionStatement(only))) expr = only.expression;
    } else expr = body;
    while (expr && (ts.isParenthesizedExpression(expr) || ts.isAwaitExpression(expr))) expr = expr.expression;
    const callee =
      expr && ts.isCallExpression(expr) && expr.arguments.some((a) => ts.isObjectLiteralExpression(a) && a.properties.length >= 2)
        ? squash(expr.expression.getText(sf))
        : null;
    const blockStatements = body && ts.isBlock(body) ? body.statements : ts.factory.createNodeArray<ts.Statement>();
    const only = blockStatements.length === 1 ? blockStatements[0]! : null;
    const switchOn = only && ts.isSwitchStatement(only) && only.caseBlock.clauses.length >= 2 ? squash(only.expression.getText(sf)) : null;
    const tries = blockStatements.filter(ts.isTryStatement);
    const catchBlock = tries.length === 1 && tries[0]!.catchClause ? squash(tries[0]!.catchClause.block.getText(sf)) : null;
    return { topCall, statements, callee, switchOn, catchBlock: catchBlock && catchBlock.length >= MIN_CATCH_CHARS ? catchBlock : null, tokens: tokensOf(text) };
  }
  return null;
}

/** The deliberate pattern two functions share, or null. `a`, `b` are function source texts. */
export function sharedPattern(a: string, b: string): string | null {
  const x = unitOf(a);
  const y = unitOf(b);
  if (!x || !y) return null;
  if (jaccard(x.tokens, y.tokens) >= NEAR_COPY) return null; // near copies are duplicates, not patterns
  if (x.topCall && x.topCall === y.topCall) return "same registration / declaration call, different arguments";
  if (x.callee && x.callee === y.callee) return "same factory call with a different config object";
  let k = 0;
  while (k < x.statements.length && k < y.statements.length && x.statements[k] === y.statements[k]) k++;
  if (k > 0 && x.statements.slice(0, k).join("").length >= MIN_PREFIX_CHARS && x.statements.length - k >= 1 && y.statements.length - k >= 1) {
    if (jaccard(tokensOf(x.statements.slice(k).join(" ")), tokensOf(y.statements.slice(k).join(" "))) < MAX_TAIL_OVERLAP) {
      return "same opening statements, different logic after them";
    }
  }
  if (x.switchOn && x.switchOn === y.switchOn) return "same switch skeleton, different cases";
  if (x.catchBlock && x.catchBlock === y.catchBlock) return "same error handling around different work";
  return null;
}
