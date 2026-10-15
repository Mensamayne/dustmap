/**
 * End-to-end code-signals adapter + prescription-free verify hints.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AdapterContext } from "../src/adapter.js";
import { defaultConfig } from "../src/config/load.js";
import {
  codeSignalsAdapter,
  findingIsPrescriptionFree,
} from "../src/signals/code/index.js";
import { takeInventory } from "../src/scan/inventory.js";

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/signals-app",
);

async function ctx(): Promise<AdapterContext> {
  const config = {
    ...defaultConfig(),
    adapters: {
      signals: {
        enabled: true,
        options: {
          cyclomatic: 4,
          maxParams: 6,
          maxBooleanParams: 2,
          repeatedConditionMinFiles: 6,
          maxFileLines: 10_000,
          cognitive: 100,
          maxNesting: 20,
          maxFunctionLines: 10_000,
        },
      },
    },
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
      if (hit === undefined) throw new Error(`missing ${rel}`);
      return hit;
    },
  };
}

describe("code-signals adapter", () => {
  it("emits complexity, boolean-params, long-parameter-list, and repeated-condition", async () => {
    const findings = await codeSignalsAdapter().run(await ctx());
    const kinds = new Set(findings.map((f) => f.kind));
    expect(kinds.has("complexity")).toBe(true);
    expect(kinds.has("boolean-params")).toBe(true);
    expect(kinds.has("long-parameter-list")).toBe(true);
    expect(kinds.has("repeated-condition")).toBe(true);

    const repeated = findings.find((f) => f.kind === "repeated-condition");
    expect(repeated?.locations).toHaveLength(6);
    expect(repeated?.category).toBe("refactor-signal");

    for (const f of findings) {
      expect(f.category).toBe("refactor-signal");
      expect(findingIsPrescriptionFree(f)).toBe(true);
      expect(f.suggestedAction).toBe("review");
      expect(f.verifyHint.toLowerCase()).not.toMatch(/extract|split into|refactor into/);
    }
  });
});
