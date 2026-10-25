/**
 * CSS rules normalized for duplicate detection (DUP-01), after the three declaration duplication
 * types of Mazinanian, Tsantalis and Mesbah (FSE 2014):
 *   I   — the same values (value order inside order-free shorthands does not matter),
 *   II  — equivalent values (colour notations, zero units, shorthand defaults: css-values.ts),
 *   III — a set of longhand declarations equivalent to a shorthand (`border-bottom-*` = `border-bottom`).
 * Every declaration is expanded to longhands with canonical values, so two rules compare as sets.
 * Rules carry their at-rule context (`@media …`): duplication only counts inside the same context.
 * `@keyframes` steps are left out — they are animation frames, not reusable rules.
 */
import postcss from "postcss";
import postcssScss from "postcss-scss";
import { isOpaqueValue, normalizeToken, normalizeValue, topLevelTokens } from "./css-values.js";

export type CssRule = {
  path: string;
  selector: string;
  context: string;
  startLine: number;
  endLine: number;
  /** The rule as written (for the fingerprint and evidence). */
  text: string;
  /** Raw declarations, whitespace-collapsed (`prop: value`), in order. */
  raw: string[];
  /** Longhand → canonical value (with ` !important`), the last applicable declaration winning. */
  decls: Map<string, string>;
};

const SIDES = ["top", "right", "bottom", "left"] as const;
const CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"] as const;
const BORDER_STYLES = new Set(["none", "hidden", "dotted", "dashed", "solid", "double", "groove", "ridge", "inset", "outset"]);
const BORDER_WIDTHS = new Set(["thin", "medium", "thick"]);

/** 1–4 value box (`margin: 1px 2px` → top 1px, right 2px, bottom 1px, left 2px). */
function box(tokens: string[]): string[] | null {
  if (tokens.length < 1 || tokens.length > 4) return null;
  const [a, b = a, c = a, d = b] = tokens;
  return [a!, b!, c!, d!];
}

/** `border` / `border-top` / `outline` tokens in any order → width, style, colour (with initial values). */
function borderParts(tokens: string[]): { width: string; style: string; color: string } | null {
  let width = "medium";
  let style = "none";
  let color = "currentcolor";
  for (const t of tokens) {
    const v = normalizeToken(t);
    if (BORDER_STYLES.has(v)) style = v;
    else if (BORDER_WIDTHS.has(v) || /^[-+]?\d*\.?\d+[a-z%]*$/.test(v) || v === "0") width = v;
    else color = v;
  }
  return { width, style, color };
}

/** A declaration as longhand → value pairs; a shorthand we cannot read stays as one pair. */
export function expandDeclaration(prop: string, value: string): Array<[string, string]> {
  const p = prop.toLowerCase();
  if (p.startsWith("--") || isOpaqueValue(value)) return [[p, value.trim().replace(/\s+/g, " ")]];
  const tokens = topLevelTokens(value);
  const norm = (v: string) => normalizeValue(v);
  if (p === "margin" || p === "padding") {
    const b = box(tokens);
    if (b) return SIDES.map((s, i) => [`${p}-${s}`, norm(b[i]!)]);
  }
  if (p === "inset") {
    const b = box(tokens);
    if (b) return SIDES.map((s, i) => [s, norm(b[i]!)]);
  }
  const aspect = /^border-(width|style|color)$/.exec(p);
  if (aspect) {
    const b = box(tokens);
    if (b) return SIDES.map((s, i) => [`border-${s}-${aspect[1]}`, norm(b[i]!)]);
  }
  if (p === "border-radius" && !value.includes("/")) {
    const b = box(tokens);
    if (b) return CORNERS.map((c, i) => [`border-${c}-radius`, norm(b[i]!)]);
  }
  if (p === "border" || p === "outline" || /^border-(top|right|bottom|left)$/.test(p)) {
    const parts = borderParts(tokens);
    if (parts) {
      const sides = p === "border" ? SIDES.map((s) => `border-${s}`) : [p];
      return sides.flatMap((s) => [
        [`${s}-width`, parts.width],
        [`${s}-style`, parts.style],
        [`${s}-color`, parts.color],
      ] as Array<[string, string]>);
    }
  }
  if (p === "gap" && tokens.length <= 2) {
    const [r, c = r] = tokens;
    return [
      ["row-gap", norm(r!)],
      ["column-gap", norm(c!)],
    ];
  }
  if (p === "overflow" && tokens.length <= 2) {
    const [x, y = x] = tokens;
    return [
      ["overflow-x", norm(x!)],
      ["overflow-y", norm(y!)],
    ];
  }
  return [[p, norm(value)]];
}

/** Property family for counting shared declarations: `margin-top` → `margin`, `border-top-color` → `border`. */
export function familyOf(longhand: string): string {
  if (/^(margin|padding)-/.test(longhand)) return longhand.split("-")[0]!;
  if ((SIDES as readonly string[]).includes(longhand)) return "inset";
  if (/^border-(top|right|bottom|left)-(width|style|color)$/.test(longhand)) return "border";
  if (/^border-.*-radius$/.test(longhand)) return "border-radius";
  if (/^outline-(width|style|color)$/.test(longhand)) return "outline";
  if (longhand === "row-gap" || longhand === "column-gap") return "gap";
  if (longhand === "overflow-x" || longhand === "overflow-y") return "overflow";
  return longhand;
}

function contextOf(node: postcss.Node): { context: string; keyframes: boolean } {
  const parts: string[] = [];
  let keyframes = false;
  for (let p = node.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type === "atrule") {
      const at = p as postcss.AtRule;
      if (/keyframes$/i.test(at.name)) keyframes = true;
      parts.unshift(`@${at.name.toLowerCase()} ${at.params.replace(/\s+/g, " ").trim()}`);
    }
  }
  return { context: parts.join(" | "), keyframes };
}

/** Full selector of a (possibly SCSS-nested) rule: `&` replaced by the parent, otherwise a descendant. */
function fullSelector(rule: postcss.Rule): string {
  let sel = rule.selector.replace(/\s+/g, " ").trim();
  for (let p = rule.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type !== "rule") continue;
    const parent = (p as postcss.Rule).selector.replace(/\s+/g, " ").trim();
    sel = sel.includes("&") ? sel.replace(/&/g, parent) : `${parent} ${sel}`;
  }
  return sel;
}

/** Rules of one stylesheet with normalized declaration sets; unparseable files yield none. */
export function cssRules(path: string, source: string): CssRule[] {
  let root: postcss.Root;
  try {
    root = /\.scss$/i.test(path) ? postcssScss.parse(source, { from: path }) : postcss.parse(source, { from: path });
  } catch {
    return [];
  }
  const out: CssRule[] = [];
  root.walkRules((rule) => {
    const { context, keyframes } = contextOf(rule);
    if (keyframes) return;
    const decls = new Map<string, string>();
    const important = new Set<string>();
    const raw: string[] = [];
    for (const node of rule.nodes ?? []) {
      if (node.type !== "decl") continue;
      if (node.prop.startsWith("$") || node.prop.startsWith("@")) continue;
      raw.push(`${node.prop.toLowerCase()}: ${node.value.replace(/\s+/g, " ").trim()}${node.important ? " !important" : ""}`);
      for (const [longhand, value] of expandDeclaration(node.prop, node.value)) {
        if (important.has(longhand) && !node.important) continue;
        decls.set(longhand, node.important ? `${value} !important` : value);
        if (node.important) important.add(longhand);
      }
    }
    if (raw.length === 0) return;
    out.push({
      path,
      selector: fullSelector(rule),
      context,
      startLine: rule.source?.start?.line ?? 1,
      endLine: rule.source?.end?.line ?? rule.source?.start?.line ?? 1,
      text: rule.toString(),
      raw,
      decls,
    });
  });
  return out;
}

/** Canonical key of a rule's whole declaration set (context included). */
export function ruleKey(rule: CssRule): string {
  return `${rule.context}\n${[...rule.decls.entries()].map(([k, v]) => `${k}:${v}`).sort().join(";")}`;
}

/**
 * Which duplication types make two equivalent declaration sets equal: I when the declarations are
 * the same as written (up to value order in shorthands), II when values had to be normalized,
 * III when one side writes a shorthand the other spells out in longhands.
 */
export function duplicationTypes(a: CssRule, b: CssRule): Array<"I" | "II" | "III"> {
  const props = (r: CssRule) => r.raw.map((d) => d.split(":")[0]!).sort().join(",");
  if (props(a) !== props(b)) {
    const types: Array<"I" | "II" | "III"> = ["III"];
    return types;
  }
  const sortedValue = (d: string) => {
    const i = d.indexOf(":");
    return `${d.slice(0, i)}:${topLevelTokens(d.slice(i + 1).toLowerCase()).sort().join(" ")}`;
  };
  const same = (r: CssRule) => r.raw.map(sortedValue).sort().join(";");
  return same(a) === same(b) ? ["I"] : ["II"];
}
