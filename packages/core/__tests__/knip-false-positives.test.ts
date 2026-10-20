/**
 * Framework entries and dynamic imports must not surface as high-confidence dead code.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AdapterContext } from "../src/adapter.js";
import { knipAdapter } from "../src/adapters/knip/index.js";
import { defaultConfig } from "../src/config/load.js";
import { takeInventory } from "../src/scan/inventory.js";

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/knip-app",
);

const PROTECTED = [
  "app/page.tsx",
  "app/api/health/route.ts",
  "bin/cli.js",
  "src/lazy.ts",
] as const;

async function fixtureContext(): Promise<AdapterContext> {
  const config = defaultConfig();
  const inv = takeInventory(fixtureRoot, config, "full");
  return {
    repoRoot: fixtureRoot,
    files: inv.files,
    roles: inv.roles,
    filesWithRole: (...wanted) => inv.files.filter((f) => wanted.includes(inv.roles.get(f)!)),
    config,
    mode: "full",
    readFile: async (rel) => {
      const hit = inv.contents.get(rel);
      if (hit === undefined) throw new Error(`missing file text: ${rel}`);
      return hit;
    },
  };
}

describe("knip false positives on knip-app", () => {
  it(
    "emits zero high-confidence findings for Next pages, routes, bin CLI, and dynamic import()",
    async () => {
      const findings = await knipAdapter().run(await fixtureContext());
      const highs = findings.filter(
        (f) =>
          f.confidence === "high" &&
          PROTECTED.some((p) => f.locations.some((loc) => loc.path === p)),
      );
      expect(highs).toEqual([]);
      // Also: those paths should not appear as unused-file at any confidence when Knip knows them.
      const unusedProtected = findings.filter(
        (f) =>
          f.kind === "unused-file" && PROTECTED.some((p) => f.locations[0]?.path === p),
      );
      expect(unusedProtected).toEqual([]);
      // Test data under fixtures/ is read from disk, never imported — not dead code (BUG-06).
      const onFixtures = findings.filter((f) => f.locations.some((loc) => loc.path.startsWith("fixtures/")));
      expect(onFixtures).toEqual([]);
      // No node_modules in the fixture: dependency verdicts cannot be checked, so never high (BUG-10).
      const deps = findings.filter((f) => f.kind === "unused-dependency" || f.kind === "unlisted-dependency");
      expect(deps.length).toBeGreaterThan(0);
      expect(deps.filter((f) => f.confidence !== "low")).toEqual([]);
    },
    60_000,
  );
});

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/knip-monorepo",
);

/** Same as a user's dustmap.config.json pointing at a file inside a workspace package. */
async function monorepoContext(): Promise<AdapterContext> {
  const config = { ...defaultConfig(), entryPoints: ["packages/beta/src/plugin.ts"] };
  const inv = takeInventory(monorepoRoot, config, "full");
  return {
    repoRoot: monorepoRoot,
    files: inv.files,
    roles: inv.roles,
    filesWithRole: (...wanted) => inv.files.filter((f) => wanted.includes(inv.roles.get(f)!)),
    config,
    mode: "full",
    readFile: async (rel) => {
      const hit = inv.contents.get(rel);
      if (hit === undefined) throw new Error(`missing file text: ${rel}`);
      return hit;
    },
  };
}

describe("knip in a workspaces monorepo without node_modules (BUG-12)", () => {
  it(
    "entries reach their package: tests and user entries are alive, a real orphan is still dead",
    async () => {
      const findings = await knipAdapter().run(await monorepoContext());
      const unusedFiles = findings.filter((f) => f.kind === "unused-file").map((f) => f.locations[0]?.path);
      expect(unusedFiles).not.toContain("packages/alpha/__tests__/double.test.ts");
      expect(unusedFiles).not.toContain("packages/beta/__tests__/quad.test.ts");
      expect(unusedFiles).not.toContain("packages/beta/src/plugin.ts");
      expect(unusedFiles).toContain("packages/beta/src/orphan.ts");
    },
    60_000,
  );
});
