import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadJudgePackage, truncatePair } from "./pair-judge.js";

const ids = (n: number, start = 0) => Array.from({ length: n }, (_, i) => start + i);

describe("pair judge (DUP-04 L4)", () => {
  it("longest-first truncation matches the Python tokenizer (checked on 72 length pairs, budget 508)", () => {
    // Expected lengths taken from transformers' tokenizer(a, b, truncation="longest_first", max_length=512).
    const cases: Array<[number, number, number, number]> = [
      [10, 10, 10, 10],
      [10, 700, 10, 498],
      [253, 300, 253, 255],
      [254, 300, 254, 254],
      [255, 255, 254, 254],
      [255, 254, 254, 254],
      [600, 10, 498, 10],
      [1000, 509, 254, 254],
      [507, 1, 507, 1],
    ];
    for (const [la, lb, ea, eb] of cases) {
      const [a, b] = truncatePair(ids(la), ids(lb, 10_000), 508);
      expect([a.length, b.length]).toEqual([ea, eb]);
      expect(a).toEqual(ids(ea));
      expect(b).toEqual(ids(eb, 10_000));
    }
  });

  it("a package that is missing or altered is a clear error, never a silent fallback", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dustmap-judge-"));
    expect(() => loadJudgePackage(dir, "nope")).toThrow(/is not installed/);
    mkdirSync(path.join(dir, "j"));
    writeFileSync(path.join(dir, "j", "model.onnx"), "x");
    writeFileSync(path.join(dir, "j", "tokenizer.json"), "{}");
    writeFileSync(
      path.join(dir, "j", "manifest.json"),
      JSON.stringify({
        schema: "dustmap-pair-judge/1",
        id: "j",
        version: "0",
        private: true,
        input: { tokenizer: "tokenizer.json", names: ["input_ids", "attention_mask"], maxTokens: 512 },
        output: { name: "score" },
        variants: { cpu: { file: "model.onnx" } },
        threshold: 0.5,
        files: { "model.onnx": { sha256: "0".repeat(64), bytes: 1 }, "tokenizer.json": { sha256: "0".repeat(64), bytes: 2 } },
      }),
    );
    expect(() => loadJudgePackage(dir, "j")).toThrow(/does not match its SHA-256/);
  });
});
