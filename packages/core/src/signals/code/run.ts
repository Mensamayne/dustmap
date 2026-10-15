/**
 * Code-signal adapter — AST metrics and repeated literal conditions → refactor-signal findings.
 * Signals only; never suggests how to reshape code.
 */
import type { FindingType } from "@dustmap/contract";
import type { Adapter, AdapterContext } from "../../adapter.js";
import { collectFileMetrics } from "./metrics.js";
import {
  collectConditionHits,
  findRepeatedConditions,
} from "./repeated-conditions.js";
import { parseCodeSignalThresholds } from "./thresholds.js";
import {
  metricsToFindings,
  repeatedConditionsToFindings,
} from "./to-findings.js";

const ADAPTER_REV = "2";

export async function runCodeSignals(ctx: AdapterContext): Promise<FindingType[]> {
  const rawOpts = ctx.config.adapters.signals?.options as Record<string, unknown> | undefined;
  const thresholds = parseCodeSignalThresholds(rawOpts);
  const files = ctx.filesWithRole("source");
  const fileMetrics = [];
  const allHits = [];

  for (const f of files) {
    const text = await ctx.readFile(f);
    // Skip non-TS/JS quickly (inventory may still include .mjs etc. — parser still works).
    fileMetrics.push(collectFileMetrics(f, text));
    allHits.push(...collectConditionHits(f, text));
  }

  const fromMetrics = metricsToFindings(fileMetrics, thresholds);
  const repeated = findRepeatedConditions(allHits, thresholds.repeatedConditionMinFiles);
  const fromRepeated = repeatedConditionsToFindings(repeated);

  const byFp = new Map<string, FindingType>();
  for (const f of [...fromMetrics, ...fromRepeated]) byFp.set(f.fingerprint, f);
  return [...byFp.values()].sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
}

export function codeSignalsAdapter(): Adapter {
  return {
    name: "signals",
    version: () => `code-signals+dm${ADAPTER_REV}`,
    run: runCodeSignals,
  };
}
