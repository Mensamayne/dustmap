/**
 * Unit tests for MCP response size cap and stale-report warnings.
 */
import { describe, expect, it } from "vitest";
import {
  applyResponseLimit,
  reportStaleWarning,
  TRUNCATION_NOTE,
  utf8Bytes,
} from "../src/limits.js";

describe("applyResponseLimit", () => {
  it("passes small payloads unchanged", () => {
    const r = applyResponseLimit({ a: 1 }, 1024);
    expect(r.truncated).toBe(false);
    expect(JSON.parse(r.text)).toEqual({ a: 1 });
    expect(r.bytes).toBe(utf8Bytes(r.text));
  });

  it("hard-cuts oversized payloads and stays under the byte cap", () => {
    const big = { blob: "x".repeat(8_000) };
    const max = 512;
    const r = applyResponseLimit(big, max);
    expect(r.truncated).toBe(true);
    expect(r.bytes).toBeLessThanOrEqual(max);
    expect(r.text).toContain(TRUNCATION_NOTE);
  });
});

describe("reportStaleWarning", () => {
  it("returns null when HEAD matches or is unknown", () => {
    expect(reportStaleWarning("abc", "abc")).toBeNull();
    expect(reportStaleWarning("abc", null)).toBeNull();
  });

  it("warns when report commit ≠ HEAD", () => {
    const w = reportStaleWarning("aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb");
    expect(w).toMatch(/stale/i);
    expect(w).toMatch(/dustmap_scan/);
  });
});
