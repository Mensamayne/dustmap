/**
 * End-to-end Knip adapter on the knip-app fixture: dead file, unused export, unused dep.
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

describe("knip adapter on knip-app fixture", () => {
  it(
    "detects unused file, export, type, dependency and unlisted import",
    async () => {
      const adapter = knipAdapter();
      expect(adapter.name).toBe("knip");
      expect(adapter.version()).toMatch(/^\d+\.\d+/);

      const findings = await adapter.run(await fixtureContext());
      const kinds = new Set(findings.map((f) => f.kind));
      expect(kinds.has("unused-file")).toBe(true);
      expect(kinds.has("unused-export")).toBe(true);
      expect(kinds.has("unused-type")).toBe(true);
      expect(kinds.has("unused-dependency")).toBe(true);
      expect(kinds.has("unlisted-dependency")).toBe(true);

      const dead = findings.find(
        (f) => f.kind === "unused-file" && f.locations[0]?.path === "src/dead.ts",
      );
      expect(dead?.confidence).toBe("high");

      const byName = findings.find(
        (f) => f.kind === "unused-file" && f.locations[0]?.path === "src/loaded-by-name.ts",
      );
      expect(byName?.confidence).toBe("low");

      expect(
        findings.some(
          (f) => f.kind === "unused-export" && f.locations[0]?.symbol === "unusedExport",
        ),
      ).toBe(true);
      expect(
        findings.some((f) => f.kind === "unused-type" && f.locations[0]?.symbol === "UnusedType"),
      ).toBe(true);
      expect(
        findings.some(
          (f) => f.kind === "unused-dependency" && f.locations[0]?.symbol === "left-pad",
        ),
      ).toBe(true);
      expect(
        findings.some((f) => f.kind === "unlisted-dependency" && f.locations[0]?.symbol === "zod"),
      ).toBe(true);
    },
    60_000,
  );
});
