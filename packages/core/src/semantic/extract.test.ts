import { describe, expect, it } from "vitest";
import { extractFunctions } from "./extract.js";
import { extractUnits } from "./units.js";

const lf = `export function total(items: number[]): number {
  // running sum
  let sum = 0;
  for (const x of items) sum += x;
  return sum;
}
`;
const crlf = lf.replace(/\n/g, "\r\n");

describe("unit bodies reach the models with LF line endings (BUG-14)", () => {
  it("a function from a Windows (CRLF) checkout has the same body and hash as from an LF file", () => {
    const [a] = extractFunctions("a.ts", lf, 1);
    const [b] = extractFunctions("b.ts", crlf, 1);
    expect(b!.body).not.toContain("\r");
    expect(b!.body).toBe(a!.body);
    expect(b!.contentHash).toBe(a!.contentHash);
  });

  it("every unit kind of the shared cut, not only functions", () => {
    const units = extractUnits("b.ts", crlf, { minTokens: 1 });
    expect(units.length).toBeGreaterThan(0);
    expect(units.every((u) => !u.body.includes("\r"))).toBe(true);
  });
});
