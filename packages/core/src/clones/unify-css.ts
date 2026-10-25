/**
 * A grouping-selector sketch for duplicated CSS (DUP-05, layer L5), offered only when it keeps the page
 * as it is (Mazinanian, Tsantalis, Mesbah, FSE 2014: order dependencies). Moving the shared declarations
 * of several rules into one rule `.a, .b { … }` moves some of them to another place in the cascade. That
 * changes the page exactly when a rule in between sets the same property to another value with the same
 * specificity (equal specificity → the later rule wins). The grouped rule is tried at the first member's
 * place and at the last member's; the sketch is offered at a place with no such rule. Rules in different
 * stylesheets or contexts are never grouped: their order depends on how pages load them.
 */
import { parse, walk, type CssNode } from "css-tree";
import type { CssRule } from "./normalize-css.js";

export type CssSketch = { safe: true; text: string } | { safe: false; reason: string };

type Specificity = [number, number, number];

const compare = (a: Specificity, b: Specificity) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** Specificity of each selector in a list (Selectors Level 4: `:is`/`:not`/`:has` take their argument's, `:where` none). */
export function specificities(selectorList: string): Specificity[] | null {
  let ast: CssNode;
  try {
    ast = parse(selectorList, { context: "selectorList" });
  } catch {
    return null;
  }
  if (ast.type !== "SelectorList") return null;
  const of = (sel: CssNode): Specificity => {
    const s: Specificity = [0, 0, 0];
    walk(sel, {
      enter(node: CssNode) {
        if (node.type === "IdSelector") s[0]++;
        else if (node.type === "ClassSelector" || node.type === "AttributeSelector") s[1]++;
        else if (node.type === "TypeSelector" && node.name !== "*") s[2]++;
        else if (node.type === "PseudoElementSelector") s[2]++;
        else if (node.type === "PseudoClassSelector") {
          const name = node.name.toLowerCase();
          if (name === "where") return walk.skip;
          if ((name === "is" || name === "not" || name === "has") && node.children) {
            let best: Specificity = [0, 0, 0];
            node.children.forEach((child) => {
              if (child.type === "SelectorList") child.children.forEach((c) => {
                const x = of(c);
                if (compare(x, best) > 0) best = x;
              });
            });
            s[0] += best[0];
            s[1] += best[1];
            s[2] += best[2];
            return walk.skip;
          }
          s[1]++;
        }
        return undefined;
      },
    });
    return s;
  };
  const out: Specificity[] = [];
  ast.children.forEach((sel) => out.push(of(sel)));
  return out;
}

const sameSpecificity = (x: Specificity[], y: Specificity[]) => x.some((a) => y.some((b) => compare(a, b) === 0));

/**
 * Rules that would change the page if `moved` declarations of `member` went to `target`'s place: rules of
 * the same stylesheet and context strictly between the two places, setting a moved property to another
 * value with the same specificity as the member.
 */
function conflicts(member: CssRule, target: CssRule, moved: readonly string[], others: readonly CssRule[], spec: Map<CssRule, Specificity[] | null>): string | null {
  if (member === target) return null;
  const [lo, hi] = member.startLine < target.startLine ? [member.startLine, target.startLine] : [target.startLine, member.startLine];
  const ms = spec.get(member)!;
  for (const r of others) {
    if (r.startLine <= lo || r.startLine >= hi) continue;
    const rs = spec.get(r) ?? null;
    for (const d of moved) {
      const prop = d.slice(0, d.indexOf(":"));
      const value = r.decls.get(prop);
      if (value === undefined || `${prop}: ${value}` === d) continue;
      if (!ms || !rs || sameSpecificity(ms, rs)) return `${r.selector} (line ${r.startLine}) sets ${prop} between ${member.selector} and the grouped rule`;
    }
  }
  return null;
}

/**
 * Grouping sketch for rules sharing `shared` declarations (`longhand: value`); `whole` when the rules
 * are equivalent in full (type I–III), so the members disappear instead of only losing the shared part.
 * `stylesheet` holds every rule of the members' file, in any order.
 */
export function sketchCss(group: readonly CssRule[], shared: readonly string[], whole: boolean, stylesheet: readonly CssRule[]): CssSketch {
  const files = new Set(group.map((r) => r.path));
  if (files.size > 1) return { safe: false, reason: `the rules live in ${files.size} stylesheets; their cascade order depends on how pages load them — a shared class has to be placed by hand` };
  const contexts = new Set(group.map((r) => r.context));
  if (contexts.size > 1) return { safe: false, reason: "the rules sit in different @media / @supports contexts" };
  const members = [...group].sort((a, b) => a.startLine - b.startLine);
  const others = stylesheet.filter((r) => r.path === members[0]!.path && r.context === members[0]!.context && !members.includes(r));
  const spec = new Map<CssRule, Specificity[] | null>();
  for (const r of [...members, ...others]) spec.set(r, specificities(r.selector));
  if (members.some((m) => !spec.get(m))) return { safe: false, reason: "a selector could not be read (preprocessor syntax?)" };
  let firstProblem = "";
  for (const target of [members[members.length - 1]!, members[0]!]) {
    const problem = members.map((m) => conflicts(m, target, shared, others, spec)).find((p) => p !== null);
    if (!problem) {
      const selectors = members.map((m) => m.selector).join(",\n");
      // Whole rules are equivalent: the first one's declarations as written; a shared part only exists as longhands.
      const body = (whole ? members[0]!.raw : shared).map((d) => `  ${d};`).join("\n");
      const place = `where ${target.selector} is (line ${target.startLine})`;
      const rest = whole
        ? `the ${members.length} separate rules go away`
        : `remove these declarations from ${members.map((m) => m.selector).join(", ")}`;
      return { safe: true, text: `${selectors} {\n${body}\n}\n— placed ${place}; ${rest}` };
    }
    firstProblem ||= problem;
  }
  return { safe: false, reason: `grouping would change the page: ${firstProblem}` };
}
