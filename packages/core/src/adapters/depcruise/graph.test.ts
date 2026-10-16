/**
 * Cycle key / extractCycles stability for dependency-cruiser shaped modules.
 */
import { describe, expect, it } from "vitest";
import { buildModuleGraph, cycleKey, extractCycles } from "./graph.js";

describe("depcruise graph helpers", () => {
  it("collapses rotated cycle listings to one key", () => {
    expect(cycleKey(["a.ts", "b.ts", "c.ts"])).toBe(cycleKey(["b.ts", "c.ts", "a.ts"]));
    expect(cycleKey(["a.ts", "b.ts", "c.ts"])).toBe(cycleKey(["c.ts", "b.ts", "a.ts"]));
  });

  it("extracts one unique cycle from circular dependency annotations", () => {
    const modules = [
      {
        source: "a.ts",
        dependencies: [
          {
            resolved: "b.ts",
            circular: true,
            cycle: [{ name: "b.ts" }, { name: "c.ts" }, { name: "a.ts" }],
            dependencyTypes: ["local", "import"],
          },
        ],
      },
      {
        source: "b.ts",
        dependencies: [
          {
            resolved: "c.ts",
            circular: true,
            cycle: [{ name: "c.ts" }, { name: "a.ts" }, { name: "b.ts" }],
            dependencyTypes: ["local", "import"],
          },
        ],
      },
      {
        source: "c.ts",
        dependencies: [
          {
            resolved: "a.ts",
            circular: true,
            cycle: [{ name: "a.ts" }, { name: "b.ts" }, { name: "c.ts" }],
            dependencyTypes: ["local", "import"],
          },
        ],
      },
    ];
    const cycles = extractCycles(modules);
    expect(cycles).toHaveLength(1);
    expect(new Set(cycles[0])).toEqual(new Set(["a.ts", "b.ts", "c.ts"]));

    const graph = buildModuleGraph(modules, new Set(["a.ts", "b.ts", "c.ts"]));
    expect(graph.edges).toHaveLength(3);
    expect(graph.cycles).toHaveLength(1);
  });
});
