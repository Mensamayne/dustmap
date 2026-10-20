/**
 * Unit tests for MCP response size cap and stale-report warnings.
 */
import { describe, expect, it } from "vitest";
import {
  applyResponseLimit,
  reportFreshness,
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

describe("reportFreshness", () => {
  it("matches HEAD as fresh", () => {
    expect(reportFreshness("abc", "abc")).toEqual({
      stale: false,
      headAvailable: true,
      warning: null,
    });
    expect(reportStaleWarning("abc", "abc")).toBeNull();
  });

  it("marks HEAD unavailable as unknown, never as fresh", () => {
    const f = reportFreshness("aaaaaaaaaaaaaaaa", null);
    expect(f.stale).toBe("unknown");
    expect(f.headAvailable).toBe(false);
    expect(f.warning).toMatch(/HEAD is unavailable/i);
    expect(reportStaleWarning("aaaaaaaaaaaaaaaa", null)).toMatch(/unavailable/i);
  });

  it("warns when report commit ≠ HEAD", () => {
    const f = reportFreshness("aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb");
    expect(f.stale).toBe(true);
    expect(f.headAvailable).toBe(true);
    expect(f.warning).toMatch(/stale/i);
    expect(f.warning).toMatch(/dustmap_scan/);
  });
});
