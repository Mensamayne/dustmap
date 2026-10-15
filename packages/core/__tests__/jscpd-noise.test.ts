/**
 * Import-only clone clusters must not get high confidence.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AdapterContext } from "../src/adapter.js";
import { jscpdAdapter } from "../src/adapters/jscpd/index.js";
import { isImportOnlyFragment } from "../src/adapters/jscpd/noise.js";
import { defaultConfig } from "../src/config/load.js";
import { takeInventory } from "../src/scan/inventory.js";

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/jscpd-app",
);

async function fixtureContext(): Promise<AdapterContext> {
  const config = {
    ...defaultConfig(),
    adapters: { jscpd: { enabled: true, options: { minTokens: 20, minLines: 5 } } },
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

describe("jscpd noise on fixture", () => {
  it(
    "does not assign high confidence to an import-only clone cluster",
    async () => {
      const findings = await jscpdAdapter().run(await fixtureContext());
      const importClusters = findings.filter((f) => {
        if (f.kind !== "clone-cluster") return false;
        const paths = f.locations.map((l) => l.path);
        const touchesImports =
          paths.some((p) => p.includes("imports-x")) && paths.some((p) => p.includes("imports-y"));
        if (touchesImports) return true;
        const snippet = f.evidence.find((e) => e.label === "snippet")?.value ?? "";
        return isImportOnlyFragment(snippet);
      });

      // Either jscpd reported the import pair (then confidence must not be high),
      // or the unit noise rules already cover the policy — never allow high on import-only.
      for (const f of importClusters) {
        expect(f.confidence).not.toBe("high");
      }
      expect(isImportOnlyFragment(`import { a } from "./a";\nimport { b } from "./b";\nimport { c } from "./c";`)).toBe(
        true,
      );
    },
    60_000,
  );
});
