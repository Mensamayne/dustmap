/**
 * `onnx` provider on the tiny model package in fixtures/onnx-model (dustmap-emb make_test_fixture.py):
 * checksums before loading, clear errors for a missing or altered package, unit vectors that do not
 * depend on batching, the CPU variant when asked, and a whole semantic scan through it — no network.
 */
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AdapterContext } from "../src/adapter.js";
import { defaultConfig } from "../src/config/load.js";
import { takeInventory } from "../src/scan/inventory.js";
import { loadModelPackage, OnnxModelError, openOnnxProvider, runSemanticAnalysis } from "../src/semantic/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const modelDir = path.resolve(here, "../fixtures/onnx-model");
const MODEL = "dustmap-test-tiny";

const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0);

describe("onnx model package", () => {
  it("verifies the manifest and every file", () => {
    const m = loadModelPackage(modelDir, MODEL);
    expect(m.output.dimensions).toBe(16);
    expect(Object.keys(m.files).sort()).toEqual(["model.fp16.onnx", "model.onnx", "tokenizer.json"]);
  });

  it("refuses a package whose file was altered, and names the file", () => {
    const copy = mkdtempSync(path.join(tmpdir(), "dustmap-onnx-"));
    cpSync(path.join(modelDir, MODEL), path.join(copy, MODEL), { recursive: true });
    writeFileSync(path.join(copy, MODEL, "tokenizer.json"), "{}");
    expect(() => loadModelPackage(copy, MODEL)).toThrow(/tokenizer\.json does not match its SHA-256/);
  });

  it("says where to put a missing model and never downloads it", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "dustmap-onnx-empty-"));
    try {
      loadModelPackage(empty, "no-such-model");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(OnnxModelError);
      expect((err as OnnxModelError).code).toBe("onnx_model_missing");
      expect((err as Error).message).toMatch(/never downloads/);
    }
  });
});

describe("onnx provider", () => {
  it("embeds unit vectors, identical alone and in a batch, on the CPU variant when asked", async () => {
    const p = await openOnnxProvider({ model: MODEL, device: "cpu" }, { modelDir, batch: 4 });
    try {
      expect(p.variant).toBe("cpu");
      expect(p.modelId).toBe("dustmap-test-tiny@0.0.1:cpu");
      const texts = ["function a(x) { return x + 1; }", "const b = (items) => items.map((i) => i * 2);", "x", "class C { m() { return 1; } }", "let y = 2;"];
      const together = await p.embed(texts);
      for (const v of together) expect(Math.abs(Math.sqrt(dot(v, v)) - 1)).toBeLessThan(1e-5);
      for (const [i, t] of texts.entries()) {
        const [alone] = await p.embed([t]);
        expect(dot(alone!, together[i]!)).toBeGreaterThan(0.99999);
      }
    } finally {
      await p.release();
    }
  });

  it("truncates long inputs to the package's input limit and counts them", async () => {
    const p = await openOnnxProvider({ model: MODEL, device: "cpu" }, { modelDir });
    try {
      const long = "const x = 1; ".repeat(200);
      const [v] = await p.embed([long]);
      expect(v).toHaveLength(16);
      expect(p.truncated.count).toBe(1);
    } finally {
      await p.release();
    }
  });

  it("auto mode uses the GPU variant only where a GPU runtime works, else falls back with a reason", async () => {
    const p = await openOnnxProvider({ model: MODEL, device: "auto" }, { modelDir });
    try {
      if (p.variant === "cpu") expect(p.gpuFallbackReason).toBeTruthy();
      else expect(p.gpuFallbackReason).toBeNull();
      const [v] = await p.embed(["function a(x) { return x + 1; }"]);
      expect(Math.abs(Math.sqrt(dot(v!, v!)) - 1)).toBeLessThan(1e-3);
    } finally {
      await p.release();
    }
  });
});

describe("semantic scan with provider onnx", () => {
  it("runs the whole scan through the model package; a second scan embeds nothing and reports the same", async () => {
    const root = path.resolve(here, "../fixtures/semantic-app");
    const base = defaultConfig();
    const config = {
      ...base,
      outputDir: mkdtempSync(path.join(tmpdir(), "dustmap-onnx-out-")),
      semantic: { ...base.semantic, provider: "onnx" as const, model: MODEL, modelDir, device: "cpu" as const, threshold: 0.8, minTokens: 10 },
    };
    const inv = takeInventory(root, config, "full");
    const ctx: AdapterContext = {
      repoRoot: root,
      files: inv.files,
      roles: inv.roles,
      filesWithRole: (...wanted) => inv.files.filter((f) => wanted.includes(inv.roles.get(f)!)),
      config,
      mode: "full",
      readFile: async (rel) => inv.contents.get(rel) ?? "",
    };
    const first = await runSemanticAnalysis(ctx);
    expect(first.stats.functions).toBeGreaterThanOrEqual(5);
    expect(first.stats.newEmbeddings).toBe(first.stats.functions);
    const second = await runSemanticAnalysis(ctx);
    expect(second.stats.newEmbeddings).toBe(0);
    expect(second.findings.map((f) => f.fingerprint)).toEqual(first.findings.map((f) => f.fingerprint));
  }, 60_000);
});
