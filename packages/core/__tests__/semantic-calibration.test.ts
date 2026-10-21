/**
 * EMB-09: calibrated bands → confidence, the report floor, the structural pattern rule (no names),
 * and a calibrated model package driving the scan's threshold and confidence.
 */
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { confidenceFor, reportFloor, sharedPattern, type Calibration } from "../src/semantic/calibration.js";
import { clusterSemanticPairs, type SemanticFunctionRef } from "../src/semantic/cluster.js";
import { openOnnxProvider } from "../src/semantic/onnx-provider.js";

const cal: Calibration = { bands: { high: 0.6, medium: 0.45, low: 0.2 } };

describe("calibrated bands", () => {
  it("map similarity to high / medium, nothing below the medium band (the report floor)", () => {
    expect(confidenceFor(0.7, cal)).toBe("high");
    expect(confidenceFor(0.5, cal)).toBe("medium");
    expect(confidenceFor(0.3, cal)).toBeNull();
    expect(reportFloor(cal)).toBe(0.45);
    expect(reportFloor({ bands: { high: 0.6, medium: null, low: null } })).toBe(0.6);
  });
});

describe("deliberate patterns, from the syntax tree only", () => {
  it("registration calls on the same receiver with different arguments", () => {
    expect(sharedPattern('bus.on("a.created", async (e) => {\n  log("a", e.id);\n  await store.save(e);\n});', 'bus.on("b.removed", async (e) => {\n  metrics.inc("removed");\n  await queue.push(e.ref, 3);\n});')).toBe(
      "same registration / declaration call, different arguments",
    );
  });

  it("one switch over the same discriminant", () => {
    const a = "function r1(s: S, a: A) {\n  switch (a.type) {\n    case \"open\":\n      return { ...s, open: true, at: Date.now() };\n    default:\n      return s;\n  }\n}";
    const b = "function r2(s: T, a: B) {\n  switch (a.type) {\n    case \"page\":\n      return { ...s, page: Math.min(s.page + 1, s.pages) };\n    default:\n      return s;\n  }\n}";
    expect(sharedPattern(a, b)).toBe("same switch skeleton, different cases");
  });

  it("the same catch block around different work", () => {
    const a = "async function h1(req, res) {\n  try {\n    await users.revoke(req.params.id);\n    res.status(204).end();\n  } catch (err) {\n    res.status(500).json({ error: String(err) });\n  }\n}";
    const b = "async function h2(req, res) {\n  try {\n    const ok = await db.ping();\n    res.json({ ok, uptime: process.uptime() });\n  } catch (err) {\n    res.status(500).json({ error: String(err) });\n  }\n}";
    expect(sharedPattern(a, b)).toBe("same error handling around different work");
  });

  it("no pattern for two implementations of one job with the same signature, nor for near copies", () => {
    const loop = "function sumPositive(xs: Item[]): number {\n  let s = 0;\n  for (const x of xs) {\n    if (x.value > 0) s += x.value;\n  }\n  return s;\n}";
    const reduce = "function addPositives(items: Item[]): number {\n  return items.filter((i) => i.value > 0).reduce((acc, i) => acc + i.value, 0);\n}";
    expect(sharedPattern(loop, reduce)).toBeNull();
    expect(sharedPattern(loop, loop.replace("sumPositive", "sumPos"))).toBeNull();
  });
});

describe("clusters with a calibrated model", () => {
  const fn = (p: string, name: string, body: string): SemanticFunctionRef => ({ path: p, name, startLine: 1, endLine: 8, body });

  it("take confidence from the bands and demote a pattern group with the pattern as evidence", () => {
    const real = { a: fn("a.ts", "sumA", "function sumA(xs) { let s = 0; for (const x of xs) s += x; return s; }"), b: fn("b.ts", "sumB", "const sumB = (xs) => xs.reduce((a, b) => a + b, 0);"), similarity: 0.65 };
    const pattern = {
      a: fn("c.ts", "onA", 'bus.on("a", async (e) => {\n  log("a", e.id);\n  await store.save(e);\n});'),
      b: fn("d.ts", "onB", 'bus.on("b", async (e) => {\n  metrics.inc("removed");\n  await queue.push(e.ref, 3);\n});'),
      similarity: 0.62,
    };
    const findings = clusterSemanticPairs([real, pattern], 0.45, cal);
    const r = findings.find((f) => f.locations.some((l) => l.path === "a.ts"))!;
    const p = findings.find((f) => f.locations.some((l) => l.path === "c.ts"))!;
    expect(r.confidence).toBe("high");
    expect(p.confidence).toBe("medium");
    expect(p.evidence.find((e) => e.label === "shared-pattern")?.value).toBe("same registration / declaration call, different arguments");
    expect(r.evidence.some((e) => e.label === "shared-pattern")).toBe(false);
  });

  it("an onnx package exposes the calibration of the variant in use", async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const dir = mkdtempSync(path.join(tmpdir(), "dustmap-cal-"));
    cpSync(path.resolve(here, "../fixtures/onnx-model/dustmap-test-tiny"), path.join(dir, "dustmap-test-tiny"), { recursive: true });
    const mf = path.join(dir, "dustmap-test-tiny", "manifest.json");
    const m = JSON.parse(readFileSync(mf, "utf8"));
    m.variants.cpu.calibration = { bands: { high: 0.9, medium: 0.7, low: 0.3 } };
    writeFileSync(mf, JSON.stringify(m));
    const provider = await openOnnxProvider({ model: "dustmap-test-tiny", device: "cpu" }, { modelDir: dir });
    try {
      expect(provider.calibration).toEqual({ bands: { high: 0.9, medium: 0.7, low: 0.3 } });
    } finally {
      await provider.release();
    }
  });
});
