import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectConditionHits, findRepeatedConditions } from "./repeated-conditions.js";

const dir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/signals-app/src",
);

describe("repeated conditions", () => {
  it("groups kind===\"sorbet\" across six fixture files into one cluster", () => {
    const hits = [];
    for (const name of ["c1.ts", "c2.ts", "c3.ts", "c4.ts", "c5.ts", "c6.ts"]) {
      const text = readFileSync(path.join(dir, name), "utf8");
      hits.push(...collectConditionHits(`src/${name}`, text));
    }
    const repeated = findRepeatedConditions(hits, 6);
    const sorbet = repeated.find((r) => r.key === 'kind==="sorbet"');
    expect(sorbet).toBeDefined();
    expect(sorbet!.locations).toHaveLength(6);
  });
});
