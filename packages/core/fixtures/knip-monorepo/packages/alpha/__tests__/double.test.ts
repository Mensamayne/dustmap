import { describe, expect, it } from "vitest";
import { double } from "../src/index.js";

describe("double", () => {
  it("doubles", () => {
    expect(double(2)).toBe(4);
  });
});
