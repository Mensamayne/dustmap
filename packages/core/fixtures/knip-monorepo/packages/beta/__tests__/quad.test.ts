import { describe, expect, it } from "vitest";
import { quad } from "../src/index.js";

describe("quad", () => {
  it("quads", () => {
    expect(quad(2)).toBe(8);
  });
});
