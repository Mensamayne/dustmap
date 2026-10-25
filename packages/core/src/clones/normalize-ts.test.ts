import { describe, expect, it } from "vitest";
import { literalChanges, normalizedUnits, renameMap } from "./normalize-ts.js";

const unit = (code: string, path = "a.ts") => normalizedUnits(path, code, 1, 1)[0]!;

describe("normalizedUnits (DUP-01 L1)", () => {
  const totalPrice = `function totalPrice(items) {
  let sum = 0;
  for (const it of items) sum += it.price * it.qty;
  return sum;
}`;

  it("a copy with other local names has the same exact key, with the rename map as evidence", () => {
    const a = unit(totalPrice);
    const b = unit(`function orderValue(lines) {
  let total = 0;
  for (const l of lines) total += l.price * l.qty;
  return total;
}`);
    expect(b.exactKey).toBe(a.exactKey);
    expect(renameMap(a, b)).toEqual([
      ["totalPrice", "orderValue"],
      ["items", "lines"],
      ["sum", "total"],
      ["it", "l"],
    ]);
  });

  it("another property (price vs weightG) is another job — different keys", () => {
    const b = unit(`function totalWeight(parcels) {
  let grams = 0;
  for (const p of parcels) grams += p.weightG * p.qty;
  return grams;
}`);
    expect(b.exactKey).not.toBe(unit(totalPrice).exactKey);
    expect(b.shapeKey).not.toBe(unit(totalPrice).shapeKey);
  });

  it("calling another function is another job", () => {
    const a = unit("function f(x) {\n  return round(x) + 1;\n}");
    const b = unit("function g(y) {\n  return floor(y) + 1;\n}");
    expect(a.exactKey).not.toBe(b.exactKey);
  });

  it("comments and formatting do not matter; export does not either", () => {
    const a = unit(totalPrice);
    const b = unit(`export function totalPrice(items) { let sum = 0; // running total
  for (const it of items) sum += it.price * it.qty; /* cart */ return sum; }`);
    expect(b.exactKey).toBe(a.exactKey);
  });

  it("literals compare by value: hex = decimal, separators and quote style do not matter", () => {
    const a = unit("function h(s) {\n  let x = 2166136261;\n  return s + 'k' + 1000 + x;\n}");
    const b = unit('function h(s) {\n  let x = 0x811c9dc5;\n  return s + "k" + 1_000 + x;\n}');
    expect(b.exactKey).toBe(a.exactKey);
  });

  it("other constants only: same shape key, different exact key, constants listed", () => {
    const a = unit('function label(open) {\n  return open ? "open" : "closed";\n}');
    const b = unit('function label(open) {\n  return open ? "yes" : "no";\n}');
    expect(a.exactKey).not.toBe(b.exactKey);
    expect(a.shapeKey).toBe(b.shapeKey);
    expect(literalChanges(a, b)).toEqual([
      ['"open"', '"yes"'],
      ['"closed"', '"no"'],
    ]);
  });

  it("object keys keep their names even when a local has the same name", () => {
    const a = unit("function f(total) {\n  return { total };\n}");
    const b = unit("function f(sum) {\n  return { sum };\n}");
    expect(a.exactKey).not.toBe(b.exactKey);
  });

  it("arrow functions bound to a name and classes are units; size floors apply", () => {
    const units = normalizedUnits(
      "a.tsx",
      "export const Badge = ({ label }: { label: string }) => {\n  return <span className=\"b\">{label}</span>;\n};\nclass Store {\n  items: string[] = [];\n  add(x: string) { this.items.push(x); }\n}\n",
      1,
      1,
    );
    expect(units.map((u) => `${u.kind}:${u.name}`)).toEqual(["function:Badge", "class:Store", "function:Store.add"]);
    expect(normalizedUnits("a.ts", totalPrice, 1000, 1)).toEqual([]);
    expect(normalizedUnits("a.ts", totalPrice, 1, 10)).toEqual([]);
  });
});
