/**
 * Structure findings from a ModuleGraph: import cycles, high fan-in/out hubs, layer breaks.
 * Uses contract kinds `cycle`, `god-module` (fan-in / fan-out via evidence), `layer-violation`.
 */
import { fingerprint, type FindingType } from "@dustmap/contract";
import { minimatch } from "minimatch";
import type { ModuleGraph } from "../../adapters/depcruise/graph.js";
import type { LayerRule } from "../../config/schema.js";
import { topPercentCutoff, type StructureThresholds } from "./thresholds.js";

const SOURCE = "depcruise";
const REVIEW_HINT =
  "Review this structural signal with the surrounding modules; no automatic change suggested.";

function layerOf(path: string, layers: readonly LayerRule[]): LayerRule | undefined {
  for (const layer of layers) {
    if (layer.paths.some((pat) => minimatch(path, pat, { dot: true }))) return layer;
  }
  return undefined;
}

function degreeMaps(graph: ModuleGraph): {
  fanIn: Map<string, number>;
  fanOut: Map<string, number>;
} {
  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const n of graph.nodes) {
    fanIn.set(n, 0);
    fanOut.set(n, 0);
  }
  for (const e of graph.edges) {
    fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1);
    fanIn.set(e.to, (fanIn.get(e.to) ?? 0) + 1);
  }
  return { fanIn, fanOut };
}

function hubFindings(
  kindLabel: "fan-in" | "fan-out",
  degrees: Map<string, number>,
  thresholds: StructureThresholds,
): FindingType[] {
  const active = [...degrees.entries()].filter(([, d]) => d > 0);
  if (active.length === 0) return [];
  const sorted = active.map(([, d]) => d).sort((a, b) => a - b);
  const cutoff = topPercentCutoff(sorted, thresholds.hubTopPercent);
  const out: FindingType[] = [];
  for (const [path, degree] of active) {
    if (degree < thresholds.hubMinDegree) continue;
    if (degree < cutoff) continue;
    const fp = fingerprint("god-module", [`${kindLabel}:${degree}`, path], [path]);
    out.push({
      fingerprint: fp,
      kind: "god-module",
      category: "structure",
      locations: [{ path }],
      evidence: [
        { label: "metric", value: kindLabel },
        { label: "degree", value: String(degree) },
        { label: "cutoff", value: String(cutoff) },
        {
          label: "summary",
          value:
            kindLabel === "fan-in"
              ? `High fan-in: ${degree} modules import this file (top ${thresholds.hubTopPercent}%)`
              : `High fan-out: this file imports ${degree} modules (top ${thresholds.hubTopPercent}%)`,
        },
      ],
      confidence: degree >= cutoff * 1.5 ? "high" : degree >= cutoff ? "medium" : "low",
      suggestedAction: "review",
      verifyHint: REVIEW_HINT,
      source: SOURCE,
    });
  }
  return out;
}

function cycleFindings(graph: ModuleGraph): FindingType[] {
  return graph.cycles.map((ring) => {
    const fp = fingerprint("cycle", ring, ring);
    return {
      fingerprint: fp,
      kind: "cycle" as const,
      category: "structure" as const,
      locations: ring.map((path) => ({ path })),
      evidence: [
        { label: "cycle-length", value: String(ring.length) },
        { label: "summary", value: `Import cycle: ${ring.join(" → ")} → ${ring[0]}` },
      ],
      confidence: "high" as const,
      suggestedAction: "review" as const,
      verifyHint: REVIEW_HINT,
      source: SOURCE,
    };
  });
}

function layerFindings(graph: ModuleGraph, layers: readonly LayerRule[]): FindingType[] {
  if (layers.length === 0) return [];
  const out: FindingType[] = [];
  const seen = new Set<string>();
  for (const e of graph.edges) {
    const fromLayer = layerOf(e.from, layers);
    const toLayer = layerOf(e.to, layers);
    if (!fromLayer || !toLayer) continue;
    if (fromLayer.name === toLayer.name) continue;
    if (fromLayer.mayImport.includes(toLayer.name)) continue;
    const key = `${fromLayer.name}\0${toLayer.name}\0${e.from}\0${e.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fp = fingerprint(
      "layer-violation",
      [`${fromLayer.name}->${toLayer.name}`, e.from, e.to],
      [fromLayer.name, toLayer.name],
    );
    out.push({
      fingerprint: fp,
      kind: "layer-violation",
      category: "structure",
      locations: [{ path: e.from }, { path: e.to }],
      evidence: [
        { label: "from-layer", value: fromLayer.name },
        { label: "to-layer", value: toLayer.name },
        { label: "from-file", value: e.from },
        { label: "to-file", value: e.to },
        {
          label: "summary",
          value: `Layer "${fromLayer.name}" imports "${toLayer.name}" but mayImport does not allow it`,
        },
      ],
      confidence: "high",
      suggestedAction: "review",
      verifyHint: REVIEW_HINT,
      source: SOURCE,
    });
  }
  return out;
}

export function buildStructureFindings(
  graph: ModuleGraph,
  layers: readonly LayerRule[],
  thresholds: StructureThresholds,
): FindingType[] {
  const { fanIn, fanOut } = degreeMaps(graph);
  const findings = [
    ...cycleFindings(graph),
    ...hubFindings("fan-in", fanIn, thresholds),
    ...hubFindings("fan-out", fanOut, thresholds),
    ...layerFindings(graph, layers),
  ];
  const byFp = new Map<string, FindingType>();
  for (const f of findings) byFp.set(f.fingerprint, f);
  return [...byFp.values()].sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}
