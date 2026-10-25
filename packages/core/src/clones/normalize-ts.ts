/**
 * Script units normalized for duplicate detection (DUP-01, layer L1). Every name bound inside a unit
 * (its own name, parameters, variables, destructuring, loop and catch bindings, type parameters) is
 * replaced by a placeholder in first-occurrence order; property names, object keys, called and
 * imported names stay, because they carry the meaning (`it.price` is not `p.weightG`). Two keys per
 * unit: with literals kept (a copy with other local names) and with literals as kind placeholders (a
 * copy that also changed its constants). Tokens come from the syntax tree, so comments and
 * formatting never matter.
 */
import { createHash } from "node:crypto";
import ts from "typescript";
import { functionAnchor, functionUnitName, isFunctionLike, scriptKindOf } from "../semantic/extract.js";

export type NormalizedUnit = {
  path: string;
  kind: "function" | "class";
  name: string;
  startLine: number;
  endLine: number;
  /** Source text of the unit (for the finding fingerprint). */
  body: string;
  tokens: number;
  /** Local names in placeholder order: `$0` is `locals[0]`. */
  locals: string[];
  /** Literal texts in order of appearance. */
  literals: string[];
  /** Locals renamed, literals kept. */
  exactKey: string;
  /** Locals renamed, literals replaced by their kind. */
  shapeKey: string;
};

const SCRIPT = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const DROPPED_KEYWORDS = new Set([ts.SyntaxKind.ExportKeyword, ts.SyntaxKind.DefaultKeyword, ts.SyntaxKind.DeclareKeyword]);

function bindingNames(name: ts.BindingName, out: Set<string>): void {
  if (ts.isIdentifier(name)) out.add(name.text);
  else for (const el of name.elements) if (!ts.isOmittedExpression(el)) bindingNames(el.name, out);
}

/** Names bound anywhere inside the unit. */
function localNames(root: ts.Node): Set<string> {
  const out = new Set<string>();
  const visit = (n: ts.Node): void => {
    if (ts.isParameter(n) || ts.isVariableDeclaration(n)) bindingNames(n.name, out);
    else if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isClassDeclaration(n) || ts.isClassExpression(n)) && n.name) out.add(n.name.text);
    else if (ts.isTypeParameterDeclaration(n)) out.add(n.name.text);
    ts.forEachChild(n, visit);
  };
  visit(root);
  return out;
}

/** An identifier that names a member, key or attribute rather than referring to a binding. */
function isMemberName(id: ts.Identifier): boolean {
  const p = id.parent;
  return (
    (ts.isPropertyAccessExpression(p) && p.name === id) ||
    (ts.isPropertyAssignment(p) && p.name === id) ||
    ts.isShorthandPropertyAssignment(p) ||
    (ts.isBindingElement(p) && p.propertyName === id) ||
    ((ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isPropertySignature(p) || ts.isMethodSignature(p)) && p.name === id) ||
    ((ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p)) && p.name === id) ||
    (ts.isEnumMember(p) && p.name === id) ||
    (ts.isQualifiedName(p) && p.right === id) ||
    ts.isJsxAttribute(p) ||
    ts.isImportSpecifier(p) ||
    ts.isExportSpecifier(p)
  );
}

function literalKind(kind: ts.SyntaxKind): string | null {
  switch (kind) {
    case ts.SyntaxKind.StringLiteral:
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
    case ts.SyntaxKind.TemplateHead:
    case ts.SyntaxKind.TemplateMiddle:
    case ts.SyntaxKind.TemplateTail:
    case ts.SyntaxKind.JsxText:
      return "$S";
    case ts.SyntaxKind.NumericLiteral:
    case ts.SyntaxKind.BigIntLiteral:
      return "$N";
    case ts.SyntaxKind.RegularExpressionLiteral:
      return "$R";
    default:
      return null;
  }
}

function leaves(node: ts.Node, sf: ts.SourceFile, out: ts.Node[]): void {
  const children = node.getChildren(sf);
  if (children.length === 0) {
    out.push(node);
    return;
  }
  for (const c of children) if (!ts.isJSDoc(c)) leaves(c, sf, out);
}

function normalize(root: ts.Node, sf: ts.SourceFile): { exact: string[]; shape: string[]; locals: string[]; literals: string[] } {
  const bound = localNames(root);
  const renamed = new Set<number>();
  const mark = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && bound.has(n.text) && !isMemberName(n)) renamed.add(n.getStart(sf));
    ts.forEachChild(n, mark);
  };
  mark(root);
  const order = new Map<string, number>();
  const exact: string[] = [];
  const shape: string[] = [];
  const literals: string[] = [];
  const tokens: ts.Node[] = [];
  leaves(root, sf, tokens);
  for (const t of tokens) {
    if (t.kind === ts.SyntaxKind.EndOfFileToken || DROPPED_KEYWORDS.has(t.kind)) continue;
    let text = t.getText(sf);
    if (t.kind === ts.SyntaxKind.JsxText) {
      text = text.replace(/\s+/g, " ").trim();
      if (!text) continue;
    }
    if (ts.isIdentifier(t) && renamed.has(t.getStart(sf))) {
      if (!order.has(t.text)) order.set(t.text, order.size);
      const ph = `$${order.get(t.text)}`;
      exact.push(ph);
      shape.push(ph);
      continue;
    }
    const lit = literalKind(t.kind);
    if (lit) {
      // Literals by value, not spelling: 0x811c9dc5 = 2166136261, 1_000 = 1000, 'a' = "a".
      if (ts.isNumericLiteral(t)) text = t.text;
      else if (ts.isStringLiteral(t)) text = JSON.stringify(t.text);
      literals.push(text);
      exact.push(text);
      shape.push(lit);
      continue;
    }
    exact.push(text);
    shape.push(text);
  }
  return { exact, shape, locals: [...order.keys()], literals };
}

const key = (tokens: string[]): string => createHash("sha256").update(tokens.join("\u0001")).digest("hex").slice(0, 32);

/** Functions and classes of one script file, normalized; units below the size floor are left out. */
export function normalizedUnits(path: string, source: string, minTokens: number, minLines: number): NormalizedUnit[] {
  if (!SCRIPT.test(path)) return [];
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKindOf(path));
  const out: NormalizedUnit[] = [];
  const add = (root: ts.Node, kind: NormalizedUnit["kind"], name: string): void => {
    const start = root.getStart(sf);
    const startLine = sf.getLineAndCharacterOfPosition(start).line + 1;
    const endLine = sf.getLineAndCharacterOfPosition(root.getEnd()).line + 1;
    if (endLine - startLine + 1 < minLines) return;
    const n = normalize(root, sf);
    if (n.exact.length < minTokens) return;
    out.push({
      path,
      kind,
      name,
      startLine,
      endLine,
      body: source.slice(start, root.getEnd()),
      tokens: n.exact.length,
      locals: n.locals,
      literals: n.literals,
      exactKey: key(n.exact),
      shapeKey: key(n.shape),
    });
  };
  const visit = (node: ts.Node): void => {
    if (isFunctionLike(node) && node.body) {
      const name = functionUnitName(node, sf);
      if (name) add(functionAnchor(node), "function", name);
    } else if ((ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name) {
      add(node, "class", node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** `a → b` pairs where two units with the same key use different local names. */
export function renameMap(a: NormalizedUnit, b: NormalizedUnit): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let i = 0; i < Math.min(a.locals.length, b.locals.length); i++) if (a.locals[i] !== b.locals[i]) out.push([a.locals[i]!, b.locals[i]!]);
  return out;
}

/** `a → b` pairs of literals that differ between two units with the same shape. */
export function literalChanges(a: NormalizedUnit, b: NormalizedUnit): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (let i = 0; i < Math.min(a.literals.length, b.literals.length); i++) if (a.literals[i] !== b.literals[i]) out.push([a.literals[i]!, b.literals[i]!]);
  return out;
}
