import { describe, expect, it } from "vitest";
import { declarationText } from "./declaration-text.js";

describe("declarationText", () => {
  const src = [
    "export const a = 1, b = 2;",
    "export function over(x: string): string;",
    "export function over(x: number): number;",
    "export function over(x: unknown) { return x; }",
    "export interface Shape { w: number }",
    "export type Alias = Shape;",
    "export class Box {}",
    "export enum Color { Red }",
    "export default function main() { return 0; }",
    "export { reexported } from './elsewhere.js';",
  ].join("\n");

  it("returns the single declarator of a multi-variable statement", () => {
    expect(declarationText("x.ts", src, "b")).toBe("b = 2");
  });

  it("joins overloads and finds interfaces, types, classes, enums", () => {
    expect(declarationText("x.ts", src, "over")?.split("\n")).toHaveLength(3);
    for (const name of ["Shape", "Alias", "Box", "Color"]) {
      expect(declarationText("x.ts", src, name)).toContain(name);
    }
  });

  it("finds the default export", () => {
    expect(declarationText("x.ts", src, "default")).toContain("function main()");
  });

  it("has no body for a re-export or an unknown name", () => {
    expect(declarationText("x.ts", src, "reexported")).toBeNull();
    expect(declarationText("x.ts", src, "missing")).toBeNull();
  });

  it("parses JSX files", () => {
    expect(declarationText("v.tsx", "export const View = () => <div>hi</div>;\n", "View")).toContain("<div>");
  });
});
