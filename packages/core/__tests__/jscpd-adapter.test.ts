/**
 * End-to-end jscpd adapter: identical block in three files → one clone-cluster.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AdapterContext } from "../src/adapter.js";
import { jscpdAdapter } from "../src/adapters/jscpd/index.js";
import { defaultConfig } from "../src/config/load.js";
import { takeInventory } from "../src/scan/inventory.js";

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/jscpd-app",
);

async function fixtureContext(
  options?: Record<string, unknown>,
): Promise<AdapterContext> {
  const config = {
    ...defaultConfig(),
    adapters: options
      ? { jscpd: { enabled: true, options } }
      : {},
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

describe("jscpd adapter on jscpd-app fixture", () => {
  it(
    "detects one clone-cluster spanning three files with the shared block",
    async () => {
      const adapter = jscpdAdapter();
      expect(adapter.name).toBe("jscpd");
      expect(adapter.version()).toMatch(/^\d+\.\d+/);

      const findings = await adapter.run(await fixtureContext({ minTokens: 30, minLines: 5 }));
      const clusters = findings.filter((f) => f.kind === "clone-cluster");
      expect(clusters.length).toBeGreaterThanOrEqual(1);

      const triple = clusters.find((f) => {
        const paths = new Set(f.locations.map((l) => l.path));
        return paths.has("src/a.ts") && paths.has("src/b.ts") && paths.has("src/c.ts");
      });
      expect(triple).toBeDefined();
      expect(triple!.locations.length).toBeGreaterThanOrEqual(3);
      expect(triple!.confidence).toBe("high");
      expect(triple!.category).toBe("duplicate");
    },
    60_000,
  );
});
