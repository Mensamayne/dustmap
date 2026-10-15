/**
 * Built-in adapter registry — every detector that ships with Dustmap registers here, and CLI,
 * MCP and target runs take their adapter list from this one place. Adapters arrive with their
 * briefs (dead code, copy-paste, semantic, signals); until then the list is legitimately empty
 * and callers report "no detectors" instead of running a scan.
 */
import type { Adapter } from "../adapter.js";

export function builtinAdapters(): Adapter[] {
  return [];
}
