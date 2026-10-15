import { describe, expect, it } from "vitest";
import { fingerprint, normalizeSnippet } from "./fingerprint.js";

describe("fingerprint", () => {
  const kind = "clone-cluster" as const;
  const body = `
    // helper
    export function add(a: number, b: number) {
      return a + b;
    }
  `;

  it("is stable when the same code is shifted by line numbers", () => {
    const shifted = Array.from({ length: 10 }, () => "// pad").join("\n") + "\n" + body;
    const a = fingerprint(kind, [body], ["add"]);
    const b = fingerprint(kind, [shifted], ["add"]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{16}$/);
  });

  it("changes when content changes", () => {
    const other = body.replace("a + b", "a - b");
    expect(fingerprint(kind, [body], ["add"])).not.toBe(
      fingerprint(kind, [other], ["add"]),
    );
  });

  it("ignores snippet and symbol order", () => {
    const a = fingerprint(kind, ["foo()", "bar()"], ["a", "b"]);
    const b = fingerprint(kind, ["bar()", "foo()"], ["b", "a"]);
    expect(a).toBe(b);
  });

  it("normalizeSnippet strips comments and whitespace", () => {
    expect(normalizeSnippet("  foo /* x */ // y\n bar ")).toBe("foobar");
  });
});
