/**
 * Built-in adapter registry — every detector that ships with Dustmap registers here, and CLI,
 * MCP and target runs take their adapter list from this one place. Adapters arrive with their
 * briefs (dead code, copy-paste, semantic, signals); until then the list is legitimately empty
 * and callers report "no detectors" instead of running a scan.
 */
import type { Adapter } from "../adapter.js";
import { semanticAdapter } from "../semantic/index.js";
import { codeSignalsAdapter } from "../signals/code/index.js";
import { gitSignalsAdapter } from "../signals/git/index.js";
import { depcruiseAdapter } from "./depcruise/index.js";
import { falsegreenAdapter } from "./falsegreen/index.js";
import { jscpdAdapter } from "./jscpd/index.js";
import { knipAdapter } from "./knip/index.js";

export function builtinAdapters(): Adapter[] {
  return [
    knipAdapter(),
    jscpdAdapter(),
    semanticAdapter(),
    codeSignalsAdapter(),
    gitSignalsAdapter(),
    depcruiseAdapter(),
    falsegreenAdapter(),
  ];
}
