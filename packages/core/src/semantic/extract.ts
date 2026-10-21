/**
 * Extract function units from TS/JS sources for embedding, with the TypeScript parser: function
 * declarations (also nested), class and object methods, accessors and constructors, and arrow /
 * function expressions bound to a name (variable, object property, class field). Exact lines; the
 * name comes from the declaration (class members as `Class.member`). The body is the unit's source
 * with comments removed (by the scanner, never by regex), so a comment edit does not change its hash.
 */
import { createHash } from "node:crypto";
import ts from "typescript";

export type ExtractedFunction = {
  path: string;
  name: string;
  startLine: number;
  endLine: number;
  /** Unit source without comments, trimmed — what is hashed and embedded. */
  body: string;
  contentHash: string;
};

const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/i;

function scriptKind(file: string): ts.ScriptKind {
  if (/\.tsx$/i.test(file)) return ts.ScriptKind.TSX;
  if (/\.jsx$/i.test(file)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/i.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function approxTokens(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Source text without comments; everything else (strings, regexes, templates) byte for byte. */
export function stripComments(text: string, kind: ts.ScriptKind): string {
  const variant = kind === ts.ScriptKind.TSX || kind === ts.ScriptKind.JSX ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, variant, text);
  let out = "";
  for (let t = scanner.scan(); t !== ts.SyntaxKind.EndOfFileToken; t = scanner.scan()) {
    if (t === ts.SyntaxKind.SingleLineCommentTrivia || t === ts.SyntaxKind.MultiLineCommentTrivia) continue;
    out += scanner.getTokenText();
  }
  return out;
}

function propertyName(name: ts.PropertyName | ts.BindingName | undefined, sf: ts.SourceFile): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name)) return `[${name.expression.getText(sf)}]`;
  return null;
}

function className(node: ts.Node, sf: ts.SourceFile): string | null {
  const cls = node.parent;
  if (cls && (ts.isClassDeclaration(cls) || ts.isClassExpression(cls))) {
    if (cls.name) return cls.name.text;
    const holder = cls.parent;
    if (holder && ts.isVariableDeclaration(holder)) return propertyName(holder.name, sf);
    return "class";
  }
  return null;
}

/** Name of a function-like node from its declaration, or null when it is anonymous (callbacks). */
function unitName(node: ts.Node, sf: ts.SourceFile): string | null {
  if (ts.isFunctionDeclaration(node)) return node.name?.text ?? (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Default ? "default" : null);
  if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
    const own = propertyName(node.name, sf);
    const owner = className(node, sf);
    return own && owner ? `${owner}.${own}` : own;
  }
  if (ts.isConstructorDeclaration(node)) {
    const owner = className(node, sf);
    return owner ? `${owner}.constructor` : "constructor";
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (ts.isFunctionExpression(node) && node.name) return node.name.text;
    const p = node.parent;
    if (ts.isVariableDeclaration(p) && p.initializer === node) return propertyName(p.name, sf);
    if (ts.isPropertyAssignment(p) && p.initializer === node) return propertyName(p.name, sf);
    if (ts.isPropertyDeclaration(p) && p.initializer === node) {
      const own = propertyName(p.name, sf);
      const owner = className(p, sf);
      return own && owner ? `${owner}.${own}` : own;
    }
    if (ts.isExportAssignment(p)) return "default";
  }
  return null;
}

function isFunctionLike(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node)
  );
}

/** Extract functions from one file. `minTokens` is a whitespace-token floor (as before). */
export function extractFunctions(path: string, source: string, minTokens: number): ExtractedFunction[] {
  if (!SOURCE.test(path)) return [];
  const kind = scriptKind(path);
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  const out: ExtractedFunction[] = [];
  const visit = (node: ts.Node): void => {
    if (isFunctionLike(node) && node.body) {
      const name = unitName(node, sf);
      if (name) {
        // A bound arrow / function expression starts at its binding (`const f = …`), like the source reads.
        const p = node.parent;
        const anchor =
          (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && (ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p))
            ? ts.isVariableDeclaration(p) && ts.isVariableDeclarationList(p.parent) && p.parent.declarations.length === 1 && ts.isVariableStatement(p.parent.parent)
              ? p.parent.parent
              : p
            : node;
        const start = anchor.getStart(sf);
        const end = node.getEnd();
        const body = stripComments(source.slice(start, end), kind).trim();
        if (approxTokens(body) >= minTokens) {
          out.push({
            path,
            name,
            startLine: sf.getLineAndCharacterOfPosition(start).line + 1,
            endLine: sf.getLineAndCharacterOfPosition(end).line + 1,
            body,
            contentHash: createHash("sha256").update(body, "utf8").digest("hex").slice(0, 32),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
