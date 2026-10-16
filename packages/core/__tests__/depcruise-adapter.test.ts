/**
 * End-to-end depcruise adapter on structure-app: cycle A→B→C→A and ui→db layer break.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AdapterContext } from "../src/adapter.js";
import { depcruiseAdapter } from "../src/adapters/depcruise/index.js";
import { defaultConfig } from "../src/config/load.js";
import { takeInventory } from "../src/scan/inventory.js";

const fixtureRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/structure-app",
);

async function ctx(): Promise<AdapterContext> {
  const config = {
    ...defaultConfig(),
    layers: [
      { name: "ui", paths: ["src/ui/**"], mayImport: [] as string[] },
      { name: "db", paths: ["src/db/**"], mayImport: [] as string[] },
    ],
    adapters: {
      depcruise: {
        enabled: true,
        options: {
          hubTopPercent: 15,
          hubMinDegree: 5,
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

describe("depcruise adapter on structure-app", () => {
  it("detects the A→B→C→A cycle and ui→db layer-violation", async () => {
    const findings = await depcruiseAdapter().run(await ctx());
    expect(findings.every((f) => f.category === "structure")).toBe(true);

    const cycle = findings.find((f) => f.kind === "cycle");
    expect(cycle).toBeDefined();
    const cyclePaths = new Set(cycle!.locations.map((l) => l.path));
    expect(cyclePaths.has("src/cycle/a.ts")).toBe(true);
    expect(cyclePaths.has("src/cycle/b.ts")).toBe(true);
    expect(cyclePaths.has("src/cycle/c.ts")).toBe(true);
    expect(cycle!.locations).toHaveLength(3);

    const viol = findings.find((f) => f.kind === "layer-violation");
    expect(viol).toBeDefined();
    expect(viol!.evidence.find((e) => e.label === "from-file")?.value).toBe("src/ui/button.ts");
    expect(viol!.evidence.find((e) => e.label === "to-file")?.value).toBe("src/db/client.ts");
    expect(viol!.evidence.find((e) => e.label === "from-layer")?.value).toBe("ui");
    expect(viol!.evidence.find((e) => e.label === "to-layer")?.value).toBe("db");

    const hub = findings.find(
      (f) =>
        f.kind === "god-module" &&
        f.locations.some((l) => l.path === "src/hub.ts") &&
        f.evidence.some((e) => e.label === "metric" && e.value === "fan-in"),
    );
    expect(hub).toBeDefined();
  });
});
