import { describe, expect, it } from "vitest";
import { Decision } from "./decisions.js";

describe("Decision", () => {
  it("accepts a reasoned keep decision", () => {
    const d = Decision.parse({
      fingerprint: "0123456789abcdef",
      verdict: "keep",
      reason: "Loaded dynamically by the framework by name.",
      by: "maintainer",
      at: "2026-10-15T12:00:00.000Z",
    });
    expect(d.verdict).toBe("keep");
  });

  it("rejects a reason shorter than 10 characters", () => {
    const result = Decision.safeParse({
      fingerprint: "0123456789abcdef",
      verdict: "wontfix",
      reason: "nope",
      by: "agent",
      at: "2026-10-15T12:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
