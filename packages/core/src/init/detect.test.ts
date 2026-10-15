import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectProject } from "./detect.js";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../test/fixtures");

describe("detectProject", () => {
  it("detects Next app router entry points", () => {
    const d = detectProject(path.join(fixtures, "next-app"));
    expect(d.frameworks).toContain("next");
    expect(d.entryPoints).toEqual(
      expect.arrayContaining([
        "app/**/page.tsx",
        "app/**/route.ts",
        "app/**/layout.tsx",
      ]),
    );
  });

  it("detects Vite entry points and vitest", () => {
    const d = detectProject(path.join(fixtures, "vite-app"));
    expect(d.frameworks).toContain("vite");
    expect(d.testRunners).toContain("vitest");
    expect(d.entryPoints).toEqual(
      expect.arrayContaining(["index.html", "src/main.ts"]),
    );
  });

  it("detects npm workspaces and package bins", () => {
    const d = detectProject(path.join(fixtures, "monorepo"));
    expect(d.workspaces).toBe(true);
    expect(d.entryPoints.some((e) => e.includes("packages/cli/bin/cli.js"))).toBe(true);
  });
});
