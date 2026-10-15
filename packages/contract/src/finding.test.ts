import { describe, expect, it } from "vitest";
import { Finding } from "./finding.js";

const valid = {
  fingerprint: "0123456789abcdef",
  kind: "unused-export" as const,
  category: "dead-code" as const,
  locations: [{ path: "src/util.ts", startLine: 10, symbol: "helper" }],
  evidence: [{ label: "export", value: "helper" }],
  confidence: "high" as const,
  suggestedAction: "review" as const,
  verifyHint: "Remove export and run the package typecheck.",
  source: "knip",
};

describe("Finding", () => {
  it("round-trips a valid finding", () => {
    const parsed = Finding.parse(valid);
    expect(Finding.parse(parsed)).toEqual(parsed);
    expect(parsed.fingerprint).toBe("0123456789abcdef");
  });

  it("rejects unknown kind", () => {
    const result = Finding.safeParse({ ...valid, kind: "auto-delete" });
    expect(result.success).toBe(false);
  });

  it("rejects empty locations", () => {
    const result = Finding.safeParse({ ...valid, locations: [] });
    expect(result.success).toBe(false);
  });

  it("rejects Windows path separators", () => {
    const result = Finding.safeParse({
      ...valid,
      locations: [{ path: "src\\util.ts" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects absolute paths", () => {
    expect(Finding.safeParse({ ...valid, locations: [{ path: "/tmp/x.ts" }] }).success).toBe(
      false,
    );
    expect(
      Finding.safeParse({ ...valid, locations: [{ path: "C:/repo/src/x.ts" }] }).success,
    ).toBe(false);
  });
});
