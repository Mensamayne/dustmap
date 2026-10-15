import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectFileMetrics } from "./metrics.js";

const fixture = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/signals-app/src/complex.ts",
);

describe("collectFileMetrics", () => {
  it("matches known cyclomatic, boolean-param and param counts on the fixture", () => {
    const text = readFileSync(fixture, "utf8");
    const m = collectFileMetrics("src/complex.ts", text);
    const grade = m.functions.find((f) => f.name === "grade");
    const flags = m.functions.find((f) => f.name === "applyFlags");
    const wide = m.functions.find((f) => f.name === "wide");

    expect(grade).toBeDefined();
    // 1 (base) + 4 decision points in the if / else-if chain
    expect(grade!.cyclomatic).toBe(5);
    expect(grade!.paramCount).toBe(1);
    expect(grade!.booleanParamCount).toBe(0);

    expect(flags).toBeDefined();
    expect(flags!.booleanParamCount).toBe(3);
    expect(flags!.paramCount).toBe(4);
    // a && b adds one more cyclomatic beyond the two ifs
    expect(flags!.cyclomatic).toBeGreaterThanOrEqual(3);

    expect(wide).toBeDefined();
    expect(wide!.paramCount).toBe(7);
    expect(wide!.cyclomatic).toBe(1);
  });
});
