/**
 * The judge on L1-shape and L2 copies (V1-02): a recorded judge, places cut by the clone layer itself,
 * bodies read as the semantic layer reads them (comments out, LF), confidence up / down / kept.
 */
import type { FindingType } from "@dustmap/contract";
import { describe, expect, it } from "vitest";
import { normalizedUnits } from "../src/clones/index.js";
import type { JudgedPair, OpenedJudge } from "../src/judge/index.js";
import { judgeTextDuplicates, MAX_GROUP_PAIRS } from "../src/scan/judge-duplicates.js";

const FILES: Record<string, string> = {
  "src/a.ts": "// price with tax\r\nexport function grossA(net: number) {\r\n  const rate = 0.23;\r\n  return net + net * rate;\r\n}\r\n",
  "src/b.ts": "export function grossB(value: number) {\n  /* other rate */\n  const r = 0.08;\n  return value + value * r;\n}\n",
};
const readFile = async (rel: string) => {
  const hit = FILES[rel];
  if (hit === undefined) throw new Error(`no ${rel}`);
  return hit;
};

function shapeClone(paths: string[], kind: FindingType["kind"] = "exact-clone"): FindingType {
  const locations = paths.map((p) => {
    const [u] = normalizedUnits(p, FILES[p]!, 0, 0);
    return { path: p, startLine: u!.startLine, endLine: u!.endLine, symbol: u!.name };
  });
  return {
    fingerprint: "0123456789abcdef",
    kind,
    category: "duplicate",
    locations,
    evidence: [{ label: "shape", value: "2 copies identical after renaming local names and constants" }],
    confidence: "medium",
    suggestedAction: "review",
    verifyHint: "check",
    source: "dustmap-clones",
  };
}

function recordedJudge(score: (a: string, b: string) => JudgedPair | null): { opened: OpenedJudge; seen: Array<readonly [string, string]> } {
  const seen: Array<readonly [string, string]> = [];
  return {
    seen,
    opened: {
      judge: {
        id: "test:judge",
        threshold: 0.5,
        stats: { read: 0, cached: 0, skipped: 0 },
        judge: async (pairs) => pairs.map(([a, b]) => (seen.push([a, b]), score(a, b))),
        release: async () => {},
      },
      note: null,
    },
  };
}

describe("judge on text duplicates (V1-02)", () => {
  it("reads the units as the semantic layer cuts them: no comments, LF line ends", async () => {
    const rec = recordedJudge(() => ({ score: 0.9 }));
    await judgeTextDuplicates([shapeClone(["src/a.ts", "src/b.ts"])], rec.opened, readFile);
    expect(rec.seen).toHaveLength(1);
    const [a, b] = rec.seen[0]!;
    expect(a).toBe("export function grossA(net: number) {\n  const rate = 0.23;\n  return net + net * rate;\n}");
    expect(b).not.toContain("other rate");
    expect(a + b).not.toContain("\r");
  });

  it("confirmed → high with the verdict; rejected or split → confidence kept, verdict attached", async () => {
    const up = await judgeTextDuplicates([shapeClone(["src/a.ts", "src/b.ts"])], recordedJudge(() => ({ score: 0.95, reason: "Same tax sum." })).opened, readFile);
    expect(up[0]!.confidence).toBe("high");
    expect(up[0]!.judgement).toEqual({ verdict: "real-duplicate", reason: "Same tax sum. (1 of 1 pairs read as the same job)", model: "test:judge" });
    expect(up[0]!.evidence.find((e) => e.label === "judge")?.value).toContain("confirmed, medium raised to high");

    const down = await judgeTextDuplicates([shapeClone(["src/a.ts", "src/b.ts"], "near-clone")], recordedJudge(() => ({ score: 0.1 })).opened, readFile);
    expect(down).toHaveLength(1);
    expect(down[0]!.confidence).toBe("medium");
    expect(down[0]!.judgement?.verdict).toBe("intentional-pattern");
    expect(down[0]!.evidence.find((e) => e.label === "judge")?.value).toContain("the copy itself is certain, so medium stays");

    let k = 0;
    const three = shapeClone(["src/a.ts", "src/b.ts"]);
    three.locations.push({ ...three.locations[1]! });
    const split = await judgeTextDuplicates([three], recordedJudge(() => ({ score: k++ === 0 ? 0.9 : 0.1 })).opened, readFile);
    expect(split[0]!.confidence).toBe("medium");
    expect(split[0]!.judgement?.verdict).toBe("uncertain");
  });

  it("leaves alone what is not its layer: exact copies, judged groups, semantic groups", async () => {
    const rec = recordedJudge(() => ({ score: 0.1 }));
    const exact = { ...shapeClone(["src/a.ts", "src/b.ts"]), confidence: "high" as const };
    const judged = { ...shapeClone(["src/a.ts", "src/b.ts"]), judgement: { verdict: "real-duplicate" as const, reason: "r", model: "m" } };
    const semantic = shapeClone(["src/a.ts", "src/b.ts"], "semantic-cluster");
    const out = await judgeTextDuplicates([exact, judged, semantic], rec.opened, readFile);
    expect(out).toEqual([exact, judged, semantic]);
    expect(rec.seen).toHaveLength(0);
  });

  it("no judge: nothing changes; a missing package and a spent budget are said in the evidence", async () => {
    const f = shapeClone(["src/a.ts", "src/b.ts"]);
    expect(await judgeTextDuplicates([f], { judge: null, note: null }, readFile)).toEqual([f]);
    const missing = await judgeTextDuplicates([f], { judge: null, note: 'pair judge "x" is not installed' }, readFile);
    expect(missing[0]!.evidence.find((e) => e.label === "judge")?.value).toBe('not judged — pair judge "x" is not installed; text similarity only');
    expect(missing[0]!.confidence).toBe("medium");
    const spent = await judgeTextDuplicates([f], recordedJudge(() => null).opened, readFile);
    expect(spent[0]!.evidence.find((e) => e.label === "judge")?.value).toContain("pair budget was spent");
    expect(spent[0]!.judgement).toBeUndefined();
  });

  it(`a large group: the lead against the first ${MAX_GROUP_PAIRS} other places`, async () => {
    const big = shapeClone(["src/a.ts", "src/b.ts"]);
    for (let i = 0; i < 12; i++) big.locations.push({ ...big.locations[1]! });
    const rec = recordedJudge(() => ({ score: 0.9 }));
    const [out] = await judgeTextDuplicates([big], rec.opened, readFile);
    expect(rec.seen).toHaveLength(MAX_GROUP_PAIRS);
    expect(out!.evidence.find((e) => e.label === "judge")?.value).toContain(`the first ${MAX_GROUP_PAIRS} of 13 other places`);
  });
});
