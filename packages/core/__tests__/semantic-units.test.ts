/**
 * Shared units (CON-02): fragments at statement edges, classes/objects, CSS rules; function cut
 * matches extractFunctions; comment edits do not change hashes.
 */
import { describe, expect, it } from "vitest";
import { extractFunctions } from "../src/semantic/extract.js";
import { extractUnits, fragmentWindows } from "../src/semantic/units.js";

const LONG_FN = `export function longWork(xs: number[]): number {
  let a = 0; // seed
  let b = 1;
  let c = 2;
  let d = 3;
  let e = 4;
  let f = 5;
  let g = 6;
  let h = 7;
  let i = 8;
  let j = 9;
  let k = 10;
  let m = 11;
  let n = 12;
  let o = 13;
  let p = 14;
  let q = 15;
  let r = 16;
  let s = 17;
  let t = 18;
  let u = 19;
  let v = 20;
  let w = 21;
  let x = 22;
  let y = 23;
  let z = 24;
  for (const item of xs) {
    a += item;
    b += item * 2;
  }
  if (a > 0) {
    c = a + b;
  }
  return a + b + c + d + e + f + g + h + i + j + k + m + n + o + p + q + r + s + t + u + v + w + x + y + z;
}
`;

describe("fragmentWindows", () => {
  it("never skips a statement and only cuts at statement edges", () => {
    const spans = [
      { startLine: 1, endLine: 1, start: 0, end: 1 },
      { startLine: 2, endLine: 2, start: 2, end: 3 },
      { startLine: 3, endLine: 5, start: 4, end: 5 },
      { startLine: 6, endLine: 6, start: 6, end: 7 },
      { startLine: 7, endLine: 10, start: 8, end: 9 },
    ];
    const wins = fragmentWindows(spans, 3, 1);
    const covered = new Set(wins.flatMap((w) => w.map((s) => s.startLine)));
    expect([...covered].sort((a, b) => a - b)).toEqual([1, 2, 3, 6, 7]);
  });
});

describe("extractUnits functions == extractFunctions", () => {
  const SOURCE = `export class Cart {
  private items: number[] = [];
  constructor(private readonly tax: number) {}
  /** total with tax */
  total(): number {
    return this.items.reduce((s, x) => s + x, 0) * (1 + this.tax);
  }
  get size() {
    return this.items.length;
  }
  onClear = () => {
    this.items = [];
  };
}

export const handlers = {
  add: (cart: Cart, n: number) => {
    return cart.total() + n;
  },
  remove(cart: Cart) {
    return cart.size - 1;
  },
};

function outer(xs: number[]) {
  function inner(x: number) {
    return x * 2; // doubled
  }
  return xs.map(inner);
}

const url = "http://example.com/a"; // not a comment inside the string
export default function () {
  return url;
}
`;

  it("same names, lines and hashes for function units", () => {
    const fns = extractFunctions("src/cart.ts", SOURCE, 1);
    const units = extractUnits("src/cart.ts", SOURCE, {
      minTokens: 1,
      includeFunctions: true,
      includeFragments: false,
      includeClasses: false,
      includeCss: false,
    }).filter((u) => u.kind === "function");
    expect(units.map((u) => ({ name: u.name, startLine: u.startLine, endLine: u.endLine, contentHash: u.contentHash }))).toEqual(
      fns.map((f) => ({ name: f.name, startLine: f.startLine, endLine: f.endLine, contentHash: f.contentHash })),
    );
  });
});

describe("extractUnits fragments", () => {
  it("emits fragments for long functions; comment edit keeps fragment hash; covers body statements", () => {
    const units = extractUnits("src/long.ts", LONG_FN, {
      minTokens: 1,
      fragmentMinFunctionLines: 20,
      fragmentWindowLines: 12,
      fragmentOverlapLines: 3,
      includeClasses: false,
      includeCss: false,
    });
    const frags = units.filter((u) => u.kind === "fragment");
    expect(frags.length).toBeGreaterThan(1);
    expect(frags.every((f) => f.parentName === "longWork")).toBe(true);

    const edited = LONG_FN.replace("// seed", "// tick");
    const again = extractUnits("src/long.ts", edited, {
      minTokens: 1,
      fragmentMinFunctionLines: 20,
      fragmentWindowLines: 12,
      fragmentOverlapLines: 3,
      includeClasses: false,
      includeCss: false,
    }).filter((u) => u.kind === "fragment");
    expect(again.map((u) => u.contentHash)).toEqual(frags.map((u) => u.contentHash));
  });
});

describe("extractUnits classes and objects", () => {
  const CLASS_SRC = `
export class Store {
  constructor(private n: number) {}
  get size() { return this.n; }
  bump = () => { this.n++; };
  reset() { this.n = 0; }
}

export const port = {
  read() { return 1; },
  write(x: number) { return x; },
};
`;

  it("class unit lists methods including getters and arrow fields", () => {
    const units = extractUnits("src/store.ts", CLASS_SRC, { minTokens: 1, includeFragments: false, includeCss: false });
    const cls = units.find((u) => u.kind === "class" && u.name === "Store");
    expect(cls).toBeTruthy();
    const names = (cls!.members ?? []).map((m) => m.name).sort();
    expect(names).toEqual(["Store.bump", "Store.constructor", "Store.reset", "Store.size"].sort());
  });

  it("object literal with ≥2 methods becomes an object unit", () => {
    const units = extractUnits("src/store.ts", CLASS_SRC, { minTokens: 1, includeFragments: false, includeCss: false });
    const obj = units.find((u) => u.kind === "object" && u.name === "port");
    expect(obj).toBeTruthy();
    expect((obj!.members ?? []).map((m) => m.name).sort()).toEqual(["read", "write"]);
  });
});

describe("extractUnits CSS", () => {
  it("extracts rules including inside @media", () => {
    const css = `
.btn { color: #fff; background: blue; }
@media (min-width: 600px) {
  .btn { padding: 8px; }
}
`;
    const units = extractUnits("styles/a.css", css);
    expect(units.some((u) => u.kind === "css-rule" && u.name.includes(".btn"))).toBe(true);
    expect(units.length).toBeGreaterThanOrEqual(2);
  });

  it("extracts nested SCSS selectors", () => {
    const scss = `
.card {
  color: red;
  &__title { font-weight: bold; }
}
`;
    const units = extractUnits("styles/a.scss", scss);
    expect(units.some((u) => u.name.includes("card"))).toBe(true);
    expect(units.some((u) => u.name.includes("title") || u.name.includes("&__title") || u.name.includes("card__title"))).toBe(true);
  });

  it("extracts constant css\`...\` tagged templates", () => {
    const src = `
import { css } from "lit";
const styles = css\`
  .x { margin: 4px; padding: 2px; }
\`;
`;
    const units = extractUnits("src/ui.ts", src, { includeFunctions: false, includeFragments: false, includeClasses: false });
    expect(units.some((u) => u.kind === "css-rule")).toBe(true);
  });
});
