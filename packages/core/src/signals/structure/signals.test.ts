/**
 * Unit tests for structure finding builders (cycles, hubs, layer breaks) without cruising.
 */
import { describe, expect, it } from "vitest";
import type { ModuleGraph } from "../../adapters/depcruise/graph.js";
import { buildStructureFindings } from "./signals.js";
import { DEFAULT_STRUCTURE_THRESHOLDS } from "./thresholds.js";

describe("buildStructureFindings", () => {
  it("emits one cycle finding for a ring", () => {
    const graph: ModuleGraph = {
      nodes: ["a.ts", "b.ts", "c.ts"],
      edges: [
        { from: "a.ts", to: "b.ts" },
        { from: "b.ts", to: "c.ts" },
        { from: "c.ts", to: "a.ts" },
      ],
      cycles: [["a.ts", "b.ts", "c.ts"]],
    };
    const findings = buildStructureFindings(graph, [], DEFAULT_STRUCTURE_THRESHOLDS);
    const cycles = findings.filter((f) => f.kind === "cycle");
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.locations.map((l) => l.path)).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(cycles[0]!.category).toBe("structure");
  });

  it("emits layer-violation with both files in evidence when ui imports db", () => {
    const graph: ModuleGraph = {
      nodes: ["src/ui/button.ts", "src/db/client.ts"],
      edges: [{ from: "src/ui/button.ts", to: "src/db/client.ts" }],
      cycles: [],
    };
    const findings = buildStructureFindings(
      graph,
      [
        { name: "ui", paths: ["src/ui/**"], mayImport: [] },
        { name: "db", paths: ["src/db/**"], mayImport: [] },
      ],
      { hubTopPercent: 5, hubMinDegree: 99 },
    );
    const viol = findings.find((f) => f.kind === "layer-violation");
    expect(viol).toBeDefined();
    expect(viol!.locations.map((l) => l.path).sort()).toEqual([
      "src/db/client.ts",
      "src/ui/button.ts",
    ]);
    expect(viol!.evidence.find((e) => e.label === "from-file")?.value).toBe("src/ui/button.ts");
    expect(viol!.evidence.find((e) => e.label === "to-file")?.value).toBe("src/db/client.ts");
    expect(viol!.evidence.find((e) => e.label === "from-layer")?.value).toBe("ui");
    expect(viol!.evidence.find((e) => e.label === "to-layer")?.value).toBe("db");
  });

  it("does not emit layer-violation when mayImport allows the target layer", () => {
    const graph: ModuleGraph = {
      nodes: ["src/ui/button.ts", "src/db/client.ts"],
      edges: [{ from: "src/ui/button.ts", to: "src/db/client.ts" }],
      cycles: [],
    };
    const findings = buildStructureFindings(
      graph,
      [
        { name: "ui", paths: ["src/ui/**"], mayImport: ["db"] },
        { name: "db", paths: ["src/db/**"], mayImport: [] },
      ],
      { hubTopPercent: 5, hubMinDegree: 99 },
    );
    expect(findings.filter((f) => f.kind === "layer-violation")).toHaveLength(0);
  });

  it("emits god-module for relative top fan-in", () => {
    const edges = [];
    for (let i = 0; i < 10; i++) {
      edges.push({ from: `leaf${i}.ts`, to: "hub.ts" });
    }
    const graph: ModuleGraph = {
      nodes: ["hub.ts", ...edges.map((e) => e.from)],
      edges,
      cycles: [],
    };
    const findings = buildStructureFindings(graph, [], {
      hubTopPercent: 10,
      hubMinDegree: 5,
    });
    const hubs = findings.filter(
      (f) => f.kind === "god-module" && f.evidence.some((e) => e.label === "metric" && e.value === "fan-in"),
    );
    expect(hubs.some((f) => f.locations[0]?.path === "hub.ts")).toBe(true);
  });
});
