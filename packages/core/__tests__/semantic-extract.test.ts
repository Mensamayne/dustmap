/**
 * Function units from the TypeScript parser: class methods, arrows in objects, nested functions,
 * exact lines, names from declarations, comments out of the body.
 */
import { describe, expect, it } from "vitest";
import { extractFunctions, stripComments } from "../src/semantic/extract.js";
import ts from "typescript";

const SOURCE = `// header comment
export class Cart {
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

describe("extractFunctions (TypeScript parser)", () => {
  const fns = extractFunctions("src/cart.ts", SOURCE, 1);
  const by = (name: string) => fns.find((f) => f.name === name);

  it("finds methods, accessors, constructors and class fields with qualified names", () => {
    expect(by("Cart.total")).toMatchObject({ startLine: 6, endLine: 8 });
    expect(by("Cart.size")).toMatchObject({ startLine: 9, endLine: 11 });
    expect(by("Cart.constructor")).toMatchObject({ startLine: 4, endLine: 4 });
    expect(by("Cart.onClear")).toMatchObject({ startLine: 12, endLine: 14 });
  });

  it("finds arrows and methods inside objects, named by their property", () => {
    expect(by("add")).toMatchObject({ startLine: 18, endLine: 20 });
    expect(by("remove")).toMatchObject({ startLine: 21, endLine: 23 });
  });

  it("finds nested functions and the outer one, and default exports", () => {
    expect(by("outer")).toMatchObject({ startLine: 26, endLine: 31 });
    expect(by("inner")).toMatchObject({ startLine: 27, endLine: 29 });
    expect(by("default")).toMatchObject({ startLine: 34, endLine: 36 });
  });

  it("skips anonymous callbacks (the reduce lambda is part of Cart.total)", () => {
    expect(fns.map((f) => f.name).sort()).toEqual(
      ["Cart.constructor", "Cart.onClear", "Cart.size", "Cart.total", "add", "default", "inner", "outer", "remove"].sort(),
    );
  });

  it("removes comments but keeps strings that look like comments; a comment edit keeps the hash", () => {
    expect(by("inner")!.body).not.toContain("doubled");
    expect(stripComments('const u = "http://x"; // c\n/* d */ let a = 1;', ts.ScriptKind.TS)).toBe('const u = "http://x"; \n let a = 1;');
    const edited = extractFunctions("src/cart.ts", SOURCE.replace("// doubled", "// times two"), 1);
    expect(edited.find((f) => f.name === "inner")!.contentHash).toBe(by("inner")!.contentHash);
  });

  it("applies the token floor and ignores non-JS files", () => {
    expect(extractFunctions("src/cart.ts", SOURCE, 12).map((f) => f.name)).toContain("outer");
    expect(extractFunctions("src/cart.ts", SOURCE, 12).map((f) => f.name)).not.toContain("Cart.size");
    expect(extractFunctions("README.md", SOURCE, 1)).toEqual([]);
  });
});
