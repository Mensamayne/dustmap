/**
 * Shared code units for scan and training data: functions, statement-boundary fragments of long
 * functions, classes / multi-method object literals, and CSS rules (.css / .scss / constant
 * CSS-in-JS literals). One cut everywhere — training size limits are filters after this module.
 */
import { createHash } from "node:crypto";
import ts from "typescript";
import { parse as parseCss, walk as walkCss, generate as generateCss } from "css-tree";
import postcss from "postcss";
import postcssScss from "postcss-scss";
import {
  extractFunctions,
  functionAnchor,
  functionUnitName,
  isFunctionLike,
  scriptKindOf,
  stripComments,
} from "./extract.js";

export type UnitKind = "function" | "fragment" | "class" | "object" | "css-rule";

export type UnitMemberRef = { name: string; startLine: number; endLine: number };

export type CodeUnit = {
  path: string;
  kind: UnitKind;
  name: string;
  startLine: number;
  endLine: number;
  /** Comment-stripped (TS/JS) or rule text (CSS) — hashed and embedded. */
  body: string;
  contentHash: string;
  parentName?: string;
  parentStartLine?: number;
  parentEndLine?: number;
  members?: UnitMemberRef[];
  /** CSS: declarations only, normalized (sorted, collapsed space) for evidence. */
  declarationsNorm?: string;
};

export type ExtractUnitsOptions = {
  minTokens?: number;
  fragmentMinFunctionLines?: number;
  fragmentWindowLines?: number;
  fragmentOverlapLines?: number;
  includeFunctions?: boolean;
  includeFragments?: boolean;
  includeClasses?: boolean;
  includeCss?: boolean;
};

const TS_SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/i;
const CSS_FILE = /\.css$/i;
const SCSS_FILE = /\.scss$/i;

type ResolvedOptions = {
  minTokens: number;
  fragmentMinFunctionLines: number;
  fragmentWindowLines: number;
  fragmentOverlapLines: number;
  includeFunctions: boolean;
  includeFragments: boolean;
  includeClasses: boolean;
  includeCss: boolean;
};

const DEFAULTS: ResolvedOptions = {
  minTokens: 1,
  fragmentMinFunctionLines: 40,
  fragmentWindowLines: 25,
  fragmentOverlapLines: 5,
  includeFunctions: true,
  includeFragments: true,
  includeClasses: true,
  includeCss: true,
};

function hashBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex").slice(0, 32);
}

function unitOf(path: string, kind: UnitKind, name: string, startLine: number, endLine: number, body: string, extra: Partial<CodeUnit> = {}): CodeUnit {
  return { path, kind, name, startLine, endLine, body, contentHash: hashBody(body), ...extra };
}

function propertyName(name: ts.PropertyName | ts.BindingName | undefined, sf: ts.SourceFile): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name)) return `[${name.expression.getText(sf)}]`;
  return null;
}

type StmtSpan = { startLine: number; endLine: number; start: number; end: number };

function statementSpans(sf: ts.SourceFile, block: ts.Block): StmtSpan[] {
  return block.statements.map((s) => {
    const start = s.getStart(sf);
    const end = s.getEnd();
    return {
      start,
      end,
      startLine: sf.getLineAndCharacterOfPosition(start).line + 1,
      endLine: sf.getLineAndCharacterOfPosition(end).line + 1,
    };
  });
}

/** Sliding windows over statements; every statement in ≥1 window; cuts only at statement edges. */
export function fragmentWindows(spans: StmtSpan[], windowLines: number, overlapLines: number): StmtSpan[][] {
  if (spans.length === 0) return [];
  const windows: StmtSpan[][] = [];
  let i = 0;
  while (i < spans.length) {
    let j = i;
    const startLine = spans[i]!.startLine;
    while (j < spans.length && spans[j]!.endLine - startLine + 1 <= windowLines) j++;
    if (j === i) j = i + 1;
    windows.push(spans.slice(i, j));
    if (j >= spans.length) break;
    const lastEnd = spans[j - 1]!.endLine;
    const overlapStartLine = lastEnd - overlapLines + 1;
    let next = j;
    for (let k = i + 1; k < j; k++) {
      if (spans[k]!.startLine >= overlapStartLine) {
        next = k;
        break;
      }
    }
    if (next <= i) next = i + 1;
    i = next;
  }
  return windows;
}

function findFunctionNode(sf: ts.SourceFile, startLine: number, endLine: number): ts.FunctionLikeDeclaration | null {
  let found: ts.FunctionLikeDeclaration | null = null;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (isFunctionLike(node) && node.body) {
      const anchor = functionAnchor(node);
      const aStart = sf.getLineAndCharacterOfPosition(anchor.getStart(sf)).line + 1;
      const aEnd = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      if (aStart === startLine && aEnd === endLine) {
        found = node;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function extractFragments(
  path: string,
  source: string,
  kind: ts.ScriptKind,
  sf: ts.SourceFile,
  fn: { name: string; startLine: number; endLine: number },
  opts: { fragmentMinFunctionLines: number; fragmentWindowLines: number; fragmentOverlapLines: number },
): CodeUnit[] {
  if (fn.endLine - fn.startLine + 1 < opts.fragmentMinFunctionLines) return [];
  const node = findFunctionNode(sf, fn.startLine, fn.endLine);
  if (!node?.body || !ts.isBlock(node.body)) return [];
  const spans = statementSpans(sf, node.body);
  if (spans.length === 0) return [];
  const windows = fragmentWindows(spans, opts.fragmentWindowLines, opts.fragmentOverlapLines);
  const out: CodeUnit[] = [];
  windows.forEach((win, idx) => {
    const start = win[0]!.start;
    const end = win[win.length - 1]!.end;
    const fragBody = stripComments(source.slice(start, end), kind).trim();
    if (!fragBody) return;
    out.push(
      unitOf(path, "fragment", `${fn.name}#frag${idx}`, win[0]!.startLine, win[win.length - 1]!.endLine, fragBody, {
        parentName: fn.name,
        parentStartLine: fn.startLine,
        parentEndLine: fn.endLine,
      }),
    );
  });
  return out;
}

function classDisplayName(node: ts.ClassDeclaration | ts.ClassExpression, sf: ts.SourceFile): string {
  if (node.name) return node.name.text;
  const holder = node.parent;
  if (holder && ts.isVariableDeclaration(holder)) return propertyName(holder.name, sf) ?? "class";
  return "class";
}

function memberRefsFromClass(node: ts.ClassDeclaration | ts.ClassExpression, sf: ts.SourceFile): UnitMemberRef[] {
  const refs: UnitMemberRef[] = [];
  for (const m of node.members) {
    if (ts.isMethodDeclaration(m) || ts.isGetAccessorDeclaration(m) || ts.isSetAccessorDeclaration(m) || ts.isConstructorDeclaration(m)) {
      const name = functionUnitName(m, sf);
      if (!name || !m.body) continue;
      refs.push({
        name,
        startLine: sf.getLineAndCharacterOfPosition(m.getStart(sf)).line + 1,
        endLine: sf.getLineAndCharacterOfPosition(m.getEnd()).line + 1,
      });
    } else if (ts.isPropertyDeclaration(m) && m.initializer && (ts.isArrowFunction(m.initializer) || ts.isFunctionExpression(m.initializer))) {
      const name = functionUnitName(m.initializer, sf);
      if (!name) continue;
      refs.push({
        name,
        startLine: sf.getLineAndCharacterOfPosition(m.getStart(sf)).line + 1,
        endLine: sf.getLineAndCharacterOfPosition(m.initializer.getEnd()).line + 1,
      });
    }
  }
  return refs;
}

function objectMethodCount(node: ts.ObjectLiteralExpression): number {
  let n = 0;
  for (const p of node.properties) {
    if (ts.isMethodDeclaration(p)) n++;
    else if (ts.isPropertyAssignment(p) && (ts.isArrowFunction(p.initializer) || ts.isFunctionExpression(p.initializer))) n++;
  }
  return n;
}

function memberRefsFromObject(node: ts.ObjectLiteralExpression, sf: ts.SourceFile): UnitMemberRef[] {
  const refs: UnitMemberRef[] = [];
  for (const p of node.properties) {
    if (ts.isMethodDeclaration(p) && p.body) {
      const name = propertyName(p.name, sf);
      if (!name) continue;
      refs.push({
        name,
        startLine: sf.getLineAndCharacterOfPosition(p.getStart(sf)).line + 1,
        endLine: sf.getLineAndCharacterOfPosition(p.getEnd()).line + 1,
      });
    } else if (ts.isPropertyAssignment(p) && (ts.isArrowFunction(p.initializer) || ts.isFunctionExpression(p.initializer))) {
      const name = propertyName(p.name, sf);
      if (!name) continue;
      refs.push({
        name,
        startLine: sf.getLineAndCharacterOfPosition(p.getStart(sf)).line + 1,
        endLine: sf.getLineAndCharacterOfPosition(p.initializer.getEnd()).line + 1,
      });
    }
  }
  return refs;
}

function objectDisplayName(node: ts.ObjectLiteralExpression, sf: ts.SourceFile): string {
  const p = node.parent;
  if (ts.isVariableDeclaration(p)) return propertyName(p.name, sf) ?? "object";
  if (ts.isPropertyAssignment(p)) return propertyName(p.name, sf) ?? "object";
  return "object";
}

function normalizeDecls(text: string): string {
  return text
    .split(";")
    .map((d) => d.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .sort()
    .join("; ");
}

function cssRuleUnit(path: string, name: string, startLine: number, endLine: number, ruleText: string, declsText: string): CodeUnit {
  const body = ruleText.replace(/\s+/g, " ").trim();
  return unitOf(path, "css-rule", name, startLine, endLine, body, { declarationsNorm: normalizeDecls(declsText) });
}

function extractCssFile(path: string, source: string): CodeUnit[] {
  const out: CodeUnit[] = [];
  try {
    const ast = parseCss(source, { positions: true });
    walkCss(ast, (node) => {
      if (node.type !== "Rule" || !node.loc) return;
      const startLine = node.loc.start.line;
      const endLine = node.loc.end.line;
      const prelude = node.prelude ? generateCss(node.prelude) : "";
      const block = node.block ? generateCss(node.block) : "{}";
      const decls: string[] = [];
      if (node.block) {
        for (const child of node.block.children) {
          if (child.type === "Declaration") decls.push(generateCss(child));
        }
      }
      out.push(cssRuleUnit(path, prelude.trim() || "rule", startLine, endLine, `${prelude}${block}`, decls.join("; ")));
    });
  } catch {
    // Unparseable CSS → no units.
  }
  return out;
}

function extractScssFile(path: string, source: string): CodeUnit[] {
  const out: CodeUnit[] = [];
  try {
    const root = postcss().process(source, { parser: postcssScss, from: path }).root;
    const walk = (node: postcss.Container, prefix: string): void => {
      node.each((child) => {
        if (child.type === "rule") {
          const sel = `${prefix}${child.selector}`.trim();
          const startLine = child.source?.start?.line ?? 1;
          const endLine = child.source?.end?.line ?? startLine;
          const decls = child.nodes?.filter((n): n is postcss.Declaration => n.type === "decl").map((d) => `${d.prop}: ${d.value}`) ?? [];
          const block = `{ ${decls.join("; ")}${decls.length ? ";" : ""} }`;
          out.push(cssRuleUnit(path, sel, startLine, endLine, `${sel} ${block}`, decls.join("; ")));
          walk(child, `${sel} `);
        } else if (child.type === "atrule") {
          walk(child, prefix);
        }
      });
    };
    walk(root, "");
  } catch {
    // ignore
  }
  return out;
}

function isCssTag(tag: ts.Expression, sf: ts.SourceFile): boolean {
  if (ts.isIdentifier(tag)) return tag.text === "css";
  if (ts.isPropertyAccessExpression(tag)) {
    const left = tag.expression.getText(sf);
    return left === "styled" || left.startsWith("styled");
  }
  if (ts.isCallExpression(tag) && ts.isIdentifier(tag.expression) && tag.expression.text === "styled") return true;
  if (ts.isCallExpression(tag) && ts.isPropertyAccessExpression(tag.expression)) {
    return tag.expression.expression.getText(sf) === "styled";
  }
  return false;
}

function extractCssInJs(path: string, source: string, sf: ts.SourceFile): CodeUnit[] {
  const out: CodeUnit[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTaggedTemplateExpression(node) && isCssTag(node.tag, sf) && ts.isNoSubstitutionTemplateLiteral(node.template)) {
      const cssText = node.template.text;
      const startLine = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      const endLine = sf.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      const inner = extractCssFile(`${path}#css-in-js`, cssText);
      if (inner.length === 0) {
        out.push(cssRuleUnit(path, "css-in-js", startLine, endLine, cssText, cssText));
      } else {
        for (const u of inner) {
          const extra: Partial<CodeUnit> = {};
          if (u.declarationsNorm !== undefined) extra.declarationsNorm = u.declarationsNorm;
          out.push(unitOf(path, "css-rule", u.name, startLine, endLine, u.body, extra));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function extractTsUnits(path: string, source: string, opts: ResolvedOptions): CodeUnit[] {
  const kind = scriptKindOf(path);
  const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind);
  const out: CodeUnit[] = [];

  const fns = extractFunctions(path, source, opts.minTokens);
  if (opts.includeFunctions) {
    for (const fn of fns) {
      out.push(unitOf(path, "function", fn.name, fn.startLine, fn.endLine, fn.body));
    }
  }
  if (opts.includeFragments) {
    const fragOpts = {
      fragmentMinFunctionLines: opts.fragmentMinFunctionLines,
      fragmentWindowLines: opts.fragmentWindowLines,
      fragmentOverlapLines: opts.fragmentOverlapLines,
    };
    for (const fn of fns) {
      out.push(...extractFragments(path, source, kind, sf, fn, fragOpts));
    }
  }

  if (opts.includeClasses) {
    const visit = (node: ts.Node): void => {
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        const start = node.getStart(sf);
        const end = node.getEnd();
        const body = stripComments(source.slice(start, end), kind).trim();
        out.push(
          unitOf(path, "class", classDisplayName(node, sf), sf.getLineAndCharacterOfPosition(start).line + 1, sf.getLineAndCharacterOfPosition(end).line + 1, body, {
            members: memberRefsFromClass(node, sf),
          }),
        );
      }
      if (ts.isObjectLiteralExpression(node) && objectMethodCount(node) >= 2) {
        const start = node.getStart(sf);
        const end = node.getEnd();
        const body = stripComments(source.slice(start, end), kind).trim();
        out.push(
          unitOf(path, "object", objectDisplayName(node, sf), sf.getLineAndCharacterOfPosition(start).line + 1, sf.getLineAndCharacterOfPosition(end).line + 1, body, {
            members: memberRefsFromObject(node, sf),
          }),
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  if (opts.includeCss) out.push(...extractCssInJs(path, source, sf));
  return out;
}

/** Extract every configured unit kind from one file. Non-matching extensions yield []. */
export function extractUnits(path: string, source: string, options: ExtractUnitsOptions = {}): CodeUnit[] {
  const opts: ResolvedOptions = {
    minTokens: options.minTokens ?? DEFAULTS.minTokens,
    fragmentMinFunctionLines: options.fragmentMinFunctionLines ?? DEFAULTS.fragmentMinFunctionLines,
    fragmentWindowLines: options.fragmentWindowLines ?? DEFAULTS.fragmentWindowLines,
    fragmentOverlapLines: options.fragmentOverlapLines ?? DEFAULTS.fragmentOverlapLines,
    includeFunctions: options.includeFunctions ?? DEFAULTS.includeFunctions,
    includeFragments: options.includeFragments ?? DEFAULTS.includeFragments,
    includeClasses: options.includeClasses ?? DEFAULTS.includeClasses,
    includeCss: options.includeCss ?? DEFAULTS.includeCss,
  };
  if (CSS_FILE.test(path)) return opts.includeCss ? extractCssFile(path, source) : [];
  if (SCSS_FILE.test(path)) return opts.includeCss ? extractScssFile(path, source) : [];
  if (!TS_SOURCE.test(path)) return [];
  return extractTsUnits(path, source, opts);
}
