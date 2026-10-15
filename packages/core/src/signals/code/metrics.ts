/**
 * Function and file metrics from the TypeScript compiler AST (no ESLint). Cyclomatic / cognitive
 * complexity, nesting, length, parameter counts — used only as evidence for refactor-signal findings.
 */
import ts from "typescript";

export type FunctionMetrics = {
  name: string;
  startLine: number;
  endLine: number;
  /** McCabe-style cyclomatic complexity (base 1). */
  cyclomatic: number;
  /** Simplified Sonar-style cognitive complexity. */
  cognitive: number;
  /** Max nesting depth inside the function body (0 = flat). */
  maxNesting: number;
  /** Inclusive line count of the function node. */
  lines: number;
  paramCount: number;
  booleanParamCount: number;
};

export type FileMetrics = {
  path: string;
  lines: number;
  functions: FunctionMetrics[];
};

function lineOf(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  );
}

function functionName(node: ts.FunctionLikeDeclaration): string {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  if (ts.isConstructorDeclaration(node)) return "constructor";
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  return "<anonymous>";
}

function isBooleanTypeNode(type: ts.TypeNode | undefined): boolean {
  if (!type) return false;
  if (type.kind === ts.SyntaxKind.BooleanKeyword) return true;
  if (ts.isLiteralTypeNode(type)) {
    return (
      type.literal.kind === ts.SyntaxKind.TrueKeyword ||
      type.literal.kind === ts.SyntaxKind.FalseKeyword
    );
  }
  if (ts.isUnionTypeNode(type)) {
    return type.types.every((t) => isBooleanTypeNode(t));
  }
  return false;
}

function countBooleanParams(params: ts.NodeArray<ts.ParameterDeclaration> | undefined): number {
  if (!params) return 0;
  let n = 0;
  for (const p of params) {
    if (isBooleanTypeNode(p.type)) n++;
  }
  return n;
}

type WalkState = {
  cyclomatic: number;
  cognitive: number;
  maxNesting: number;
};

/**
 * Walk a function body. Cyclomatic: +1 per decision. Cognitive: +1 (+nesting) for control flow,
 * +1 for else / else-if, +1 for sequences of && / || beyond the first.
 */
function analyzeBody(body: ts.Node, sf: ts.SourceFile): Omit<FunctionMetrics, "name" | "startLine" | "endLine" | "lines" | "paramCount" | "booleanParamCount"> {
  const state: WalkState = { cyclomatic: 1, cognitive: 0, maxNesting: 0 };

  const visit = (node: ts.Node, nesting: number): void => {
    state.maxNesting = Math.max(state.maxNesting, nesting);

    switch (node.kind) {
      case ts.SyntaxKind.IfStatement: {
        const ifNode = node as ts.IfStatement;
        state.cyclomatic += 1;
        state.cognitive += 1 + nesting;
        visit(ifNode.expression, nesting);
        visit(ifNode.thenStatement, nesting + 1);
        if (ifNode.elseStatement) {
          // else / else-if structural increment (Sonar-like)
          state.cognitive += 1;
          if (ts.isIfStatement(ifNode.elseStatement)) {
            // else-if: the nested if adds its own cyclomatic/cognitive via visit
            visit(ifNode.elseStatement, nesting);
          } else {
            visit(ifNode.elseStatement, nesting + 1);
          }
        }
        return;
      }
      case ts.SyntaxKind.WhileStatement:
      case ts.SyntaxKind.DoStatement:
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement: {
        state.cyclomatic += 1;
        state.cognitive += 1 + nesting;
        ts.forEachChild(node, (c) => visit(c, nesting + 1));
        return;
      }
      case ts.SyntaxKind.CaseClause: {
        state.cyclomatic += 1;
        state.cognitive += 1 + nesting;
        ts.forEachChild(node, (c) => visit(c, nesting + 1));
        return;
      }
      case ts.SyntaxKind.CatchClause: {
        state.cyclomatic += 1;
        state.cognitive += 1 + nesting;
        ts.forEachChild(node, (c) => visit(c, nesting + 1));
        return;
      }
      case ts.SyntaxKind.ConditionalExpression: {
        state.cyclomatic += 1;
        state.cognitive += 1 + nesting;
        ts.forEachChild(node, (c) => visit(c, nesting + 1));
        return;
      }
      case ts.SyntaxKind.BinaryExpression: {
        const bin = node as ts.BinaryExpression;
        if (
          bin.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          bin.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
          bin.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
          state.cyclomatic += 1;
          // Cognitive: +1 per additional boolean operator in a sequence
          state.cognitive += 1;
        }
        break;
      }
      default:
        break;
    }

    // Do not recurse into nested function bodies — they get their own metrics.
    if (isFunctionLike(node) && node !== body && node.body) {
      return;
    }
    ts.forEachChild(node, (c) => visit(c, nesting));
  };

  visit(body, 0);
  void sf;
  return {
    cyclomatic: state.cyclomatic,
    cognitive: state.cognitive,
    maxNesting: state.maxNesting,
  };
}

function metricsForFunction(node: ts.FunctionLikeDeclaration, sf: ts.SourceFile): FunctionMetrics | null {
  const body = node.body;
  if (!body) return null;
  const startLine = lineOf(sf, node.getStart(sf));
  const endLine = lineOf(sf, node.end);
  const analyzed = analyzeBody(body, sf);
  return {
    name: functionName(node),
    startLine,
    endLine,
    lines: endLine - startLine + 1,
    paramCount: node.parameters?.length ?? 0,
    booleanParamCount: countBooleanParams(node.parameters),
    ...analyzed,
  };
}

/** Collect per-function and file-level metrics for one source file. */
export function collectFileMetrics(repoRelativePosix: string, sourceText: string): FileMetrics {
  const sf = ts.createSourceFile(
    repoRelativePosix,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    repoRelativePosix.endsWith(".tsx") || repoRelativePosix.endsWith(".jsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );
  const functions: FunctionMetrics[] = [];

  const visit = (node: ts.Node): void => {
    if (isFunctionLike(node)) {
      const m = metricsForFunction(node, sf);
      if (m) functions.push(m);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  const lines = sourceText.length === 0 ? 0 : sourceText.split(/\r?\n/).length;
  return { path: repoRelativePosix, lines, functions };
}
