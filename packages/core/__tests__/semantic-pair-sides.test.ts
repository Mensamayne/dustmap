/**
 * BUG-07: each side of a jscpd semantic pair carries its own name and code, and the cluster
 * fingerprint follows every member. Recorded jscpd report — no model, no network.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clusterSemanticPairs } from "../src/semantic/cluster.js";
import { pairsFromJscpdReport } from "../src/semantic/jscpd-semantic.js";

const totalOf = `export function totalOf(values: number[]): number {
  let sum = 0;
  for (const value of values) {
    if (value > 0) {
      sum += value;
    }
  }
  return sum;
}
`;
const foldSum = (op: string) => `// helper module
export function foldSum(list: number[]): number {
  let result = 0;
  for (const item of list) {
    if (item ${op} 0) {
      result += item;
    }
  }
  return result;
}
`;

function scanTree(second: string): string {
  const root = mkdtempSync(path.join(tmpdir(), "dustmap-sem-sides-"));
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, "src", "total-of.ts"), totalOf);
  writeFileSync(path.join(root, "src", "fold-sum.ts"), second);
  return root;
}

/** Shape of jscpd --semantic JSON: `fragment` holds the FIRST file's text only. */
function recordedReport(root: string) {
  return {
    duplicates: [
      {
        kind: "semantic",
        similarity: 0.883,
        fragment: totalOf,
        firstFile: { name: path.join(root, "src", "total-of.ts"), start: 1, end: 9, startLoc: { line: 1 }, endLoc: { line: 9 } },
        secondFile: { name: path.join(root, "src", "fold-sum.ts"), start: 2, end: 10, startLoc: { line: 2 }, endLoc: { line: 10 } },
      },
    ],
  };
}

describe("jscpd semantic pair sides (BUG-07)", () => {
  it("names and bodies come from each side's own file", () => {
    const root = scanTree(foldSum(">"));
    const [pair] = pairsFromJscpdReport(recordedReport(root), root);
    expect(pair?.a).toMatchObject({ path: "src/total-of.ts", name: "totalOf", startLine: 1 });
    expect(pair?.b).toMatchObject({ path: "src/fold-sum.ts", name: "foldSum", startLine: 2 });
    expect(pair?.b.body).toContain("result += item");
    expect(pair?.b.body).not.toContain("sum += value");
  });

  it("editing the second function changes the cluster fingerprint", () => {
    const fpFor = (second: string) => {
      const root = scanTree(second);
      const [finding] = clusterSemanticPairs(pairsFromJscpdReport(recordedReport(root), root), 0.82);
      expect(finding?.locations.map((l) => l.symbol)).toEqual(["foldSum", "totalOf"]);
      return finding!.fingerprint;
    };
    expect(fpFor(foldSum(">="))).not.toBe(fpFor(foldSum(">")));
  });
});
