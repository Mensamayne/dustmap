import { describe, expect, it } from "vitest";
import { canonicalColor, normalizeValue } from "./css-values.js";
import { cssRules, duplicationTypes, expandDeclaration, familyOf, ruleKey } from "./normalize-css.js";

const rules = (css: string, path = "a.css") => cssRules(path, css);

describe("CSS values (type II)", () => {
  it("colours in every exact notation are one value (FSE 2014, table 1: violet)", () => {
    const forms = ["violet", "#EE82EE", "rgb(238, 130, 238)", "rgba(238,130,238,1)"];
    expect(new Set(forms.map(canonicalColor)).size).toBe(1);
    // The paper's HSL is rounded (76%, 72%): it lands one unit off on green and stays a distinct value —
    // close colours are not merged, so nothing visually different is ever reported as the same.
    expect(canonicalColor("hsl(300, 76%, 72%)")).toBe("rgba(238,129,238,1)");
    expect(canonicalColor("hsla(300,76%,72%,1)")).toBe(canonicalColor("hsl(300, 76%, 72%)"));
    expect(canonicalColor("white")).toBe(canonicalColor("#fff"));
    expect(canonicalColor("transparent")).toBe("rgba(0,0,0,0)");
    expect(canonicalColor("rgb(0 0 0 / 50%)")).toBe("rgba(0,0,0,0.5)");
  });

  it("zero lengths, leading zeros and case", () => {
    expect(normalizeValue("0PX")).toBe("0");
    expect(normalizeValue(".50em")).toBe("0.5em");
    expect(normalizeValue("Solid")).toBe("solid");
    expect(normalizeValue('url("A.png")')).toBe('url("A.png")');
  });
});

describe("shorthand expansion (type III)", () => {
  it("box shorthands with defaults: padding 2px 4px = 2px 4px 2px 4px", () => {
    expect(expandDeclaration("padding", "2px 4px")).toEqual(expandDeclaration("padding", "2px 4px 2px 4px"));
  });

  it("border in any value order (type I per the paper)", () => {
    expect(expandDeclaration("border", "transparent solid 1px")).toEqual(expandDeclaration("border", "1px solid transparent"));
  });

  it("variables and SCSS stay unexpanded", () => {
    expect(expandDeclaration("margin", "var(--gap)")).toEqual([["margin", "var(--gap)"]]);
    expect(expandDeclaration("padding", "$space 2px")).toEqual([["padding", "$space 2px"]]);
  });

  it("families group longhands back", () => {
    expect(familyOf("margin-top")).toBe("margin");
    expect(familyOf("border-bottom-color")).toBe("border");
    expect(familyOf("color")).toBe("color");
  });
});

describe("cssRules and duplication types (Gmail examples, FSE 2014 fig. 5)", () => {
  it("type II: color white vs #fff", () => {
    const [a, b] = rules(".fJ { color: white; font-weight: bold }\n.Ik { color: #fff; font-weight: bold }");
    expect(ruleKey(a!)).toBe(ruleKey(b!));
    expect(duplicationTypes(a!, b!)).toEqual(["II"]);
  });

  it("type III: border-bottom longhands vs shorthand", () => {
    const [a, b] = rules(
      ".sG0wIf { border-bottom-color: #e5e5e5; border-bottom-style: solid; border-bottom-width: 1px }\nbody .aeN { border-bottom: 1px solid #e5e5e5 }",
    );
    expect(ruleKey(a!)).toBe(ruleKey(b!));
    expect(duplicationTypes(a!, b!)).toEqual(["III"]);
  });

  it("type I: the same declarations under another selector", () => {
    const [a, b] = rules(".z-b-Vn { cursor: default; font-size: 11px }\n.z-b-Gn { font-size: 11px; cursor: default }");
    expect(ruleKey(a!)).toBe(ruleKey(b!));
    expect(duplicationTypes(a!, b!)).toEqual(["I"]);
  });

  it("another value is not a duplicate; another media context is not either", () => {
    const [a, b] = rules(".a { color: red; padding: 4px }\n.b { color: blue; padding: 4px }");
    expect(ruleKey(a!)).not.toBe(ruleKey(b!));
    const [c, d] = rules(".a { color: red; padding: 4px }\n@media (max-width: 600px) { .b { color: red; padding: 4px } }");
    expect(d!.context).toBe("@media (max-width: 600px)");
    expect(ruleKey(c!)).not.toBe(ruleKey(d!));
  });

  it("important wins over a later plain declaration; keyframes are skipped; SCSS nesting resolves", () => {
    const [a] = rules(".a { color: red !important; color: blue }");
    expect(a!.decls.get("color")).toBe(`${canonicalColor("red")} !important`);
    expect(rules("@keyframes k { from { opacity: 0 } to { opacity: 1 } }")).toEqual([]);
    const scss = cssRules("a.scss", ".card { padding: 4px; &:hover { color: red; } .title { margin: 0 } }");
    expect(scss.map((r) => r.selector)).toEqual([".card", ".card:hover", ".card .title"]);
  });
});
