/**
 * Semantic adapter: three near-identical implementations → one cluster; second scan embeds nothing new.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { AdapterContext } from "../src/adapter.js";
import { defaultConfig } from "../src/config/load.js";
import {
  createMemoryEmbeddingProvider,
  runSemanticAnalysis,
} from "../src/semantic/index.js";
import { takeInventory } from "../src/scan/inventory.js";

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/semantic-app",
);

async function ctx(): Promise<AdapterContext> {
  const out = mkdtempSync(path.join(tmpdir(), "dustmap-sem-out-"));
  const config = {
    ...defaultConfig(),
    outputDir: out,
    semantic: {
      ...defaultConfig().semantic,
      provider: "onnx" as const,
      threshold: 0.75,
      minTokens: 20,
      model: "memory-test-embed",
    },
    adapters: {
      semantic: { enabled: true },
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

describe("semantic adapter fixture", () => {
  it(
    "clusters three sum implementations and embeds nothing on the second scan",
    async () => {
      const provider = createMemoryEmbeddingProvider("memory-test-embed");
      const context = await ctx();
      const first = await runSemanticAnalysis(context, { provider });
      const triple = first.findings.find((f) => {
        const names = new Set(f.locations.map((l) => l.symbol));
        return names.has("totalOf") && names.has("accumulate") && names.has("foldSum");
      });
      expect(triple).toBeDefined();
      expect(triple!.kind).toBe("semantic-cluster");
      expect(triple!.locations.length).toBeGreaterThanOrEqual(3);
      expect(first.stats.newEmbeddings).toBeGreaterThan(0);

      const second = await runSemanticAnalysis(context, { provider });
      expect(second.stats.newEmbeddings).toBe(0);
      expect(second.findings.some((f) => f.fingerprint === triple!.fingerprint)).toBe(true);
    },
    30_000,
  );
});
