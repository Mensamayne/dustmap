/**
 * dependency-cruiser adapter public surface — ModuleGraph for structure signals and later ranking.
 */
export {
  depcruiseAdapter,
  runDepcruise,
  cruiseModuleGraph,
} from "./run.js";
export {
  buildModuleGraph,
  extractCycles,
  cycleKey,
  graphNeighbors,
} from "./graph.js";
export type { ModuleGraph, ModuleEdge, CruiseModuleLike } from "./graph.js";
