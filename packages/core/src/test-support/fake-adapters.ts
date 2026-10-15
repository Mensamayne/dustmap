/**
 * Test doubles for scan orchestration — produce deterministic findings or throw on demand.
 */
import { fingerprint, type FindingType } from "@dustmap/contract";
import type { Adapter, AdapterContext } from "../adapter.js";

export function stubFinding(file: string, symbol: string): FindingType {
  const fp = fingerprint("unused-export", [`export const ${symbol} = 1`], [symbol]);
  return {
    fingerprint: fp,
    kind: "unused-export",
    category: "dead-code",
    locations: [{ path: file, startLine: 1, symbol }],
    evidence: [{ label: "export", value: symbol }],
    confidence: "high",
    suggestedAction: "review",
    verifyHint: "Remove the export and typecheck.",
    source: "fake",
  };
}

export function countingAdapter(name: string): Adapter & { runs: number } {
  const adapter = {
    name,
    runs: 0,
    version: () => "1.0.0",
    async run(ctx: AdapterContext): Promise<FindingType[]> {
      adapter.runs++;
      return ctx.files.map((f, i) => stubFinding(f, `sym${i}`));
    },
  };
  return adapter;
}

export function throwingAdapter(name: string, message: string): Adapter {
  return {
    name,
    version: () => "9.9.9",
    async run(): Promise<FindingType[]> {
      throw new Error(message);
    },
  };
}

export function singleFileAdapter(name: string, onlyFile: string, symbol: string): Adapter {
  return {
    name,
    version: () => "1.0.0",
    async run(ctx: AdapterContext): Promise<FindingType[]> {
      if (!ctx.files.includes(onlyFile)) return [];
      return [stubFinding(onlyFile, symbol)];
    },
  };
}
