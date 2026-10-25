import { describe, expect, it } from "vitest";
import { cssRules } from "./normalize-css.js";
import { sketchCss, specificities } from "./unify-css.js";

const rulesOf = (css: string) => cssRules("s.css", css);
const pick = (rules: ReturnType<typeof rulesOf>, ...selectors: string[]) => rules.filter((r) => selectors.includes(r.selector));

describe("CSS grouping sketch (DUP-05 L5)", () => {
  it("specificity: ids, classes, types; :is takes its argument, :where nothing", () => {
    expect(specificities("#a .b p")).toEqual([[1, 1, 1]]);
    expect(specificities(".a:hover, a::before")).toEqual([[0, 2, 0], [0, 0, 2]]);
    expect(specificities(":is(#x, .y) a")).toEqual([[1, 0, 1]]);
    expect(specificities(":where(#x) a")).toEqual([[0, 0, 1]]);
  });

  it("equivalent rules in one stylesheet → one grouping rule", () => {
    const rules = rulesOf(".a { color: red; padding: 4px }\n.x { margin: 0 }\n.b { padding: 4px; color: #f00 }");
    const s = sketchCss(pick(rules, ".a", ".b"), ["color: rgba(255,0,0,1)", "padding-top: 4px"], true, rules);
    expect(s.safe).toBe(true);
    if (s.safe) expect(s.text).toContain(".a,\n.b {");
  });

  it("a rule in between that sets the same property with the same specificity blocks the move", () => {
    const rules = rulesOf(".a { color: red; padding: 4px }\n.c { color: blue }\n.b { color: red; padding: 4px }\n.d { color: green }");
    // .c sits between .a and .b with color: blue at the same specificity: at .b's place .a would turn red over .c;
    // at .a's place .b would lose to .c. Either way an element with both classes changes.
    const s = sketchCss(pick(rules, ".a", ".b"), ["color: rgba(255,0,0,1)"], false, rules);
    expect(s).toEqual({ safe: false, reason: "grouping would change the page: .c (line 2) sets color between .a and the grouped rule" });
  });

  it("a rule in between with higher specificity, or the same value, does not block", () => {
    const rules = rulesOf(".a { color: red }\n#main .c { color: blue }\n.e { color: red }\n.b { color: red }");
    expect(sketchCss(pick(rules, ".a", ".b"), ["color: rgba(255,0,0,1)"], true, rules).safe).toBe(true);
  });

  it("rules in two stylesheets or two contexts are not grouped", () => {
    const a = cssRules("a.css", ".a { color: red; padding: 4px }");
    const b = cssRules("b.css", ".b { color: red; padding: 4px }");
    expect(sketchCss([...a, ...b], ["color: rgba(255,0,0,1)"], true, [...a, ...b]).safe).toBe(false);
    const m = rulesOf(".a { color: red }\n@media (max-width: 600px) { .b { color: red } }");
    const r = sketchCss(m, ["color: rgba(255,0,0,1)"], true, m);
    expect(r.safe ? "" : r.reason).toContain("contexts");
  });
});
