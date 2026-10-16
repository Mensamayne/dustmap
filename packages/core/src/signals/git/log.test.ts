import { describe, expect, it } from "vitest";
import { parseNumstatLog, resolveRename, summarizeTouches } from "./log.js";

describe("parseNumstatLog", () => {
  it("counts commits, skips merges and mass commits, resolves renames", () => {
    const raw = [
      "\x01COMMIT\x01aaa\x01feat: add a\x01parent1\x01",
      "1\t0\tsrc/a.ts",
      "1\t0\tsrc/b.ts",
      "\x01COMMIT\x01bbb\x01merge stuff\x01p1 p2\x01",
      "1\t0\tsrc/a.ts",
      "\x01COMMIT\x01ccc\x01mass format\x01parent1\x01",
      ...Array.from({ length: 5 }, (_, i) => `1\t0\tf${i}.ts`),
      "\x01COMMIT\x01ddd\x01rename\x01parent1\x01",
      "0\t0\told/name.ts => new/name.ts",
      "\x01COMMIT\x01eee\x01touch new\x01parent1\x01",
      "1\t0\tnew/name.ts",
      "",
    ].join("\n");

    const log = parseNumstatLog(raw, 3);
    expect(log.skippedMerges).toBe(1);
    expect(log.skippedMass).toBe(1);
    expect(log.commits.map((c) => c.sha)).toEqual(["aaa", "ddd", "eee"]);
    expect(log.renames["old/name.ts"]).toBe("new/name.ts");
    expect(resolveRename("old/name.ts", log.renames)).toBe("new/name.ts");
    const eee = log.commits.find((c) => c.sha === "eee");
    expect(eee?.files).toEqual(["new/name.ts"]);
  });

  it("summarizes change and fix counts", () => {
    const log = parseNumstatLog(
      [
        "\x01COMMIT\x01a\x01fix: broken thing\x01p\x01",
        "1\t0\ta.ts",
        "\x01COMMIT\x01b\x01feat: ok\x01p\x01",
        "1\t0\ta.ts",
        "1\t0\tb.ts",
        "",
      ].join("\n"),
      40,
    );
    const sum = summarizeTouches(log, /(^fix(\(|:|\/)|\bfix\b)/i);
    expect(sum.changeCount.get("a.ts")).toBe(2);
    expect(sum.fixCount.get("a.ts")).toBe(1);
    expect(sum.fixCount.get("b.ts") ?? 0).toBe(0);
  });
});
