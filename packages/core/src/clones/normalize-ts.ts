/**
 * Script units normalized for duplicate detection (DUP-01, layer L1). Every name bound inside a unit
 * (its own name, parameters, variables, destructuring, loop and catch bindings, type parameters) is
 * replaced by a placeholder in first-occurrence order; property names, object keys, called and
 * imported names stay, because they carry the meaning (`it.price` is not `p.weightG`). Two keys per
 * unit: with literals kept (a copy with other local names) and with literals as kind placeholders (a
 * copy that also changed its constants). Tokens come from the syntax tree, so comments and
 * formatting never matter. For near copies (DUP-02, layer L2) each unit also keeps its normalized
 * logical lines (one per statement, member, property or JSX element part), with every local blindly
 * renamed to `$` as NiCad does, so an inserted line does not shift the names of the lines after it.
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
  /** Normalized source lines of the unit (L2). */
  lines: NormalizedLine[];
};

export type NormalizedLine = {
  /** 1-based file line where the logical line starts. */
  line: number;
  /** Every file line holding one of its tokens, ascending (a wrapped call; `if (…) {` and its `}`). */
  spans: number[];
  /** Tokens of the line joined by spaces; locals as `$`, literals by value. */
  text: string;
  tokens: number;
  /** Local names on the line, in order (for the rename map of a near copy). */
  locals: string[];
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

/**
 * Owner of a logical line: a statement, class or type member, object property, switch clause, enum
 * member, or JSX element part. Lines follow syntax, not the author's line breaks, so a wrapped
 * signature and the same signature on one line are one line (NiCad's pretty-printing).
 */
function ownsLine(n: ts.Node): boolean {
  return (
    (ts.isStatement(n) && !ts.isBlock(n)) ||
    ts.isClassElement(n) ||
    ts.isTypeElement(n) ||
    ts.isObjectLiteralElementLike(n) ||
    ts.isCaseOrDefaultClause(n) ||
    ts.isEnumMember(n) ||
    ts.isJsxOpeningElement(n) ||
    ts.isJsxClosingElement(n) ||
    ts.isJsxSelfClosingElement(n) ||
    ts.isJsxText(n) ||
    (ts.isJsxExpression(n) && ts.isJsxElement(n.parent))
  );
}

const CLOSERS = new Set([")", "]", "}"]);

/** Role of a token for the unification sketch (DUP-05): what a difference at this token may become. */
export type TokenRole = "local" | "literal" | "name" | "member" | "type" | "target" | "tag" | "syntax";

/** One normalized token with its place in the file (only built for sketches, never for a whole scan). */
export type TokenDetail = {
  /** Text as in the line (locals as `$`, literals by value). */
  text: string;
  /** Source text of the token. */
  source: string;
  start: number;
  end: number;
  /** Index into the unit's `lines`. */
  line: number;
  role: TokenRole;
  /**
   * Where a parameter goes when this literal differs and how it is written there: inside a template
   * string between its delimiters (`${p}`), or as a JSX expression (`{p}`) for JSX text and attribute
   * strings. Absent: the whole token is replaced by the parameter name.
   */
  slot?: { start: number; end: number; write: "template" | "jsx" };
};

/** Parameter slot of a literal token (see TokenDetail.slot). */
function slotOf(t: ts.Node, sf: ts.SourceFile): TokenDetail["slot"] {
  const start = t.getStart(sf);
  const end = t.getEnd();
  switch (t.kind) {
    case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
    case ts.SyntaxKind.TemplateTail:
      return { start: start + 1, end: end - 1, write: "template" };
    case ts.SyntaxKind.TemplateHead:
    case ts.SyntaxKind.TemplateMiddle:
      return { start: start + 1, end: end - 2, write: "template" };
    case ts.SyntaxKind.JsxText:
      return { start, end, write: "jsx" };
    case ts.SyntaxKind.StringLiteral:
      return ts.isJsxAttribute(t.parent) ? { start, end, write: "jsx" } : undefined;
    default:
      return undefined;
  }
}

function inTypePosition(n: ts.Node): boolean {
  // The token itself may be a type (`string`); an identifier is never a stop (it also counts as an expression).
  if (ts.isTypeNode(n)) return true;
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isTypeNode(p) || ts.isTypeAliasDeclaration(p) || ts.isInterfaceDeclaration(p) || ts.isHeritageClause(p) || ts.isTypeParameterDeclaration(p)) return true;
    if (ts.isStatement(p) || ts.isExpression(p) || ts.isClassElement(p)) return false;
  }
  return false;
}

function isAssignmentTarget(id: ts.Identifier): boolean {
  const p = id.parent;
  if (ts.isBinaryExpression(p) && p.left === id && p.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && p.operatorToken.kind <= ts.SyntaxKind.LastAssignment) return true;
  return (ts.isPrefixUnaryExpression(p) || ts.isPostfixUnaryExpression(p)) && (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken);
}

function roleOf(t: ts.Node, local: boolean): TokenRole {
  if (local) return "local";
  // Anything inside a type (keywords, literal types, names) differs only through a type parameter.
  if (inTypePosition(t)) return "type";
  // A quoted key (`{ "a": 1 }`, `"b"() {}`) names a member; written as a parameter it would be the key `p1`.
  const owner = t.parent as ts.Node & { name?: ts.Node };
  if (literalKind(t.kind) && owner.name === t && (ts.isObjectLiteralElementLike(owner) || ts.isClassElement(owner) || ts.isTypeElement(owner) || ts.isEnumMember(owner))) return "member";
  if (literalKind(t.kind)) return "literal";
  if (!ts.isIdentifier(t)) return "syntax";
  const p = t.parent;
  if ((ts.isJsxOpeningElement(p) || ts.isJsxClosingElement(p) || ts.isJsxSelfClosingElement(p)) && p.tagName === t) return "tag";
  if (isMemberName(t)) return "member";
  if (isAssignmentTarget(t)) return "target";
  return "name";
}

function normalize(
  root: ts.Node,
  sf: ts.SourceFile,
  detail?: TokenDetail[],
): { exact: string[]; shape: string[]; locals: string[]; literals: string[]; lines: NormalizedLine[] } {
  const bound = localNames(root);
  const renamed = new Set<number>();
  const mark = (n: ts.Node): void => {
    if (ts.isIdentifier(n) && bound.has(n.text) && !isMemberName(n)) renamed.add(n.getStart(sf));
    ts.forEachChild(n, mark);
  };
  mark(root);
  const leafNodes: ts.Node[] = [];
  leaves(root, sf, leafNodes);
  const kept: Array<{ node: ts.Node; text: string }> = [];
  for (const t of leafNodes) {
    if (t.kind === ts.SyntaxKind.EndOfFileToken || DROPPED_KEYWORDS.has(t.kind)) continue;
    const text = t.kind === ts.SyntaxKind.JsxText ? t.getText(sf).replace(/\s+/g, " ").trim() : t.getText(sf);
    if (text) kept.push({ node: t, text });
  }
  const order = new Map<string, number>();
  const exact: string[] = [];
  const shape: string[] = [];
  const literals: string[] = [];
  const lines: NormalizedLine[] = [];
  const byOwner = new Map<ts.Node, NormalizedLine>();
  const onLine = (t: ts.Node, text: string, local?: string): void => {
    let owner = t;
    while (owner !== root && !ownsLine(owner)) owner = owner.parent;
    const at = sf.getLineAndCharacterOfPosition(t.getStart(sf)).line + 1;
    let line = byOwner.get(owner);
    if (!line) {
      line = { line: at, spans: [], text: "", tokens: 0, locals: [] };
      byOwner.set(owner, line);
      lines.push(line);
    }
    if (line.spans[line.spans.length - 1] !== at) line.spans.push(at);
    line.text = line.tokens ? `${line.text} ${text}` : text;
    line.tokens++;
    if (local) line.locals.push(local);
    if (detail) {
      const slot = slotOf(t, sf);
      detail.push({ text, source: t.getText(sf), start: t.getStart(sf), end: t.getEnd(), line: lines.indexOf(line), role: roleOf(t, local !== undefined), ...(slot ? { slot } : {}) });
    }
  };
  for (const [k, { node: t, text: raw }] of kept.entries()) {
    // A trailing comma is formatting: `f(a, b,)` is `f(a, b)`.
    if (raw === "," && CLOSERS.has(kept[k + 1]?.text ?? "")) continue;
    let text = raw;
    if (ts.isIdentifier(t) && renamed.has(t.getStart(sf))) {
      if (!order.has(t.text)) order.set(t.text, order.size);
      const ph = `$${order.get(t.text)}`;
      exact.push(ph);
      shape.push(ph);
      onLine(t, "$", t.text);
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
      onLine(t, text);
      continue;
    }
    exact.push(text);
    shape.push(text);
    onLine(t, text);
  }
  return { exact, shape, locals: [...order.keys()], literals, lines };
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
      lines: n.lines,
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

export type UnitDetail = {
  unit: NormalizedUnit;
  tokens: TokenDetail[];
  /**
   * Where parameters go in the unit's own function: appended to its parameter list (`positional`; a bare
   * arrow parameter gets wrapped), or — for a component that renders JSX — added to its destructured
   * props (`props-add`) or written as a new props pattern (`props-new`). Null: `paramBlock` says why.
   */
  paramInsert: {
    at: number;
    /** `before`: the new parameters go in front of an optional, defaulted or rest parameter (followed by a comma). */
    comma: boolean | "before";
    wrap: { start: number; end: number } | null;
    mode: "positional" | "props-add" | "props-new";
  } | null;
  paramBlock?: string;
  /** The file text the offsets point into, and where the unit starts in it. */
  source: string;
  offset: number;
  /** The unit is a class member: parse it inside a class. */
  member: boolean;
};

/** The function a unit stands for: the node itself or the function bound by a variable statement. */
function ownFunction(root: ts.Node): ts.FunctionLikeDeclaration | null {
  if (isFunctionLike(root)) return root;
  let found: ts.FunctionLikeDeclaration | null = null;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (isFunctionLike(n) && functionAnchor(n) === root) found = n;
    else ts.forEachChild(n, visit);
  };
  visit(root);
  return found;
}

/**
 * One unit again, with token positions and roles (DUP-05 sketches). Found by its start line and name in
 * a fresh parse of the file, so a scan never keeps positions for all its units.
 */
export function unitDetail(path: string, source: string, startLine: number, name: string): UnitDetail | null {
  if (!SCRIPT.test(path)) return null;
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKindOf(path));
  let out: UnitDetail | null = null;
  const tryUnit = (root: ts.Node, kind: NormalizedUnit["kind"], unitName: string): void => {
    if (out || unitName !== name) return;
    const start = root.getStart(sf);
    if (sf.getLineAndCharacterOfPosition(start).line + 1 !== startLine) return;
    const tokens: TokenDetail[] = [];
    const n = normalize(root, sf, tokens);
    const fn = kind === "function" ? ownFunction(root) : null;
    let paramInsert: UnitDetail["paramInsert"] = null;
    let paramBlock: string | undefined;
    if (fn) {
      const ps = fn.parameters;
      const open = fn.getChildren(sf).some((c) => c.kind === ts.SyntaxKind.OpenParenToken);
      const last = ps[ps.length - 1];
      let jsx = false;
      const findJsx = (x: ts.Node): void => {
        if (jsx) return;
        if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x)) jsx = true;
        else ts.forEachChild(x, findJsx);
      };
      if (fn.body) findJsx(fn.body);
      if (jsx && ps.length === 0) paramInsert = { at: ps.pos, comma: false, wrap: null, mode: "props-new" };
      else if (jsx && ps.length === 1 && ts.isObjectBindingPattern(ps[0]!.name)) {
        const els = ps[0]!.name.elements;
        paramInsert = { at: els.length ? els[els.length - 1]!.getEnd() : els.pos, comma: els.length > 0, wrap: null, mode: "props-add" };
      } else if (jsx) paramBlock = "a component that takes its props as one object: the values would be new props";
      else {
        // Required parameters cannot follow optional, defaulted or rest ones: insert in front of the first such.
        const loose = ps.find((p) => p.questionToken || p.initializer || p.dotDotDotToken);
        paramInsert = loose
          ? { at: loose.getStart(sf), comma: "before", wrap: null, mode: "positional" }
          : last
            ? { at: last.getEnd(), comma: true, wrap: open ? null : { start: last.getStart(sf), end: last.getEnd() }, mode: "positional" }
            : { at: ps.pos, comma: false, wrap: null, mode: "positional" };
      }
    }
    out = {
      unit: {
        path,
        kind,
        name: unitName,
        startLine,
        endLine: sf.getLineAndCharacterOfPosition(root.getEnd()).line + 1,
        body: source.slice(start, root.getEnd()),
        tokens: n.exact.length,
        locals: n.locals,
        literals: n.literals,
        exactKey: key(n.exact),
        shapeKey: key(n.shape),
        lines: n.lines,
      },
      tokens,
      paramInsert,
      ...(paramBlock ? { paramBlock } : {}),
      source,
      offset: start,
      member: ts.isClassElement(root),
    };
  };
  const visit = (node: ts.Node): void => {
    if (out) return;
    if (isFunctionLike(node) && node.body) {
      const unitName = functionUnitName(node, sf);
      if (unitName) tryUnit(functionAnchor(node), "function", unitName);
    } else if ((ts.isClassDeclaration(node) || ts.isClassExpression(node)) && node.name) {
      tryUnit(node, "class", node.name.text);
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
