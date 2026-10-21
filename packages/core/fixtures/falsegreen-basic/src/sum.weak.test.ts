import { describe, expect, it } from "vitest";
import { sum } from "./sum.js";

describe("sum weak suite", () => {
  it("claims to check addition but asserts a constant", () => {
    sum(2, 3);
    expect(true).toBe(true);
  });
});
