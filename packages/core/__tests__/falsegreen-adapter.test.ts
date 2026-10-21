/**
 * End-to-end falsegreen adapter: tautology → false-green-test; clean expect → no finding on that file.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AdapterContext } from "../src/adapter.js";
import { falsegreenAdapter } from "../src/adapters/falsegreen/index.js";
import { defaultConfig } from "../src/config/load.js";
import { takeInventory } from "../src/scan/inventory.js";

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/falsegreen-basic",
);

async function fixtureContext(
  options?: Record<string, unknown>,
): Promise<AdapterContext> {
  const config = {
    ...defaultConfig(),
    adapters: options
      ? { falsegreen: { enabled: true, options } }
      : { falsegreen: { enabled: true } },
  };
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

describe("falsegreen adapter on falsegreen-basic fixture", () => {
  it(
    "flags the tautology test and leaves the clean sum test without a finding",
    async () => {
      const adapter = falsegreenAdapter();
      expect(adapter.name).toBe("falsegreen");
      expect(adapter.version()).toMatch(/^\d+\.\d+/);

      const findings = await adapter.run(await fixtureContext());
      const weak = findings.filter((f) => f.kind === "false-green-test");
      expect(weak.length).toBeGreaterThanOrEqual(1);

      const onWeakFile = weak.filter((f) =>
        f.locations.some((l) => l.path.endsWith("sum.weak.test.ts")),
      );
      expect(onWeakFile.length).toBeGreaterThanOrEqual(1);
      expect(onWeakFile[0]?.category).toBe("refactor-signal");
      expect(onWeakFile.some((f) => f.confidence === "high")).toBe(true);
      expect(
        onWeakFile.some((f) => f.evidence.some((e) => e.label === "code" && e.value === "C5")),
      ).toBe(true);

      const onClean = weak.filter((f) =>
        f.locations.some((l) => l.path.endsWith("sum.clean.test.ts")),
      );
      expect(onClean).toHaveLength(0);
    },
    60_000,
  );
});
