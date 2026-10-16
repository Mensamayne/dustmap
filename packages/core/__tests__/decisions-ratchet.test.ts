/**
 * Decisions mute keep/wontfix; content change (new fingerprint) restores visibility.
 * Ratchet: old baseline fingerprints are quiet; a new one fails the check.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fingerprint, type FindingType } from "@dustmap/contract";
import {
  applyDecisions,
  loadDecisions,
  upsertDecision,
} from "../src/decisions/index.js";
import {
  checkRatchet,
  loadBaseline,
  updateBaseline,
} from "../src/ratchet/index.js";

function makeFinding(snippet: string, file = "src/a.ts"): FindingType {
  const fp = fingerprint("unused-export", [snippet], ["x"]);
  return {
    fingerprint: fp,
    kind: "unused-export",
    category: "dead-code",
    locations: [{ path: file, symbol: "x" }],
    evidence: [],
    confidence: "high",
    suggestedAction: "review",
    verifyHint: "Review.",
    source: "test",
  };
}

describe("decisions store", () => {
  it("keep removes a finding; changed content (new fingerprint) brings it back", () => {
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-dec-"));
    const first = makeFinding("export const x = 1;");
    upsertDecision(out, {
      fingerprint: first.fingerprint,
      verdict: "keep",
      reason: "Loaded dynamically by the framework by name.",
      by: "test",
      at: new Date().toISOString(),
    });
    const muted = applyDecisions([first], loadDecisions(out));
    expect(muted).toHaveLength(0);

    const changed = makeFinding("export const x = 2;");
    expect(changed.fingerprint).not.toBe(first.fingerprint);
    const again = applyDecisions([changed], loadDecisions(out));
    expect(again).toHaveLength(1);
    expect(again[0]!.fingerprint).toBe(changed.fingerprint);
  });
});

describe("ratchet baseline", () => {
  it("old finding is quiet; a new fingerprint fails with exitCode 1", () => {
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-rat-"));
    const old = makeFinding("export const old = 1;", "src/old.ts");
    const neu = makeFinding("export const neu = 1;", "src/new.ts");
    expect(old.fingerprint).not.toBe(neu.fingerprint);

    updateBaseline(out, [old], { minConfidence: "medium" });
    const baseline = loadBaseline(out);
    expect(baseline.fingerprints).toContain(old.fingerprint);

    const onlyOld = checkRatchet([old], baseline, { minConfidence: "medium" });
    expect(onlyOld.newFindings).toHaveLength(0);
    expect(onlyOld.exitCode).toBe(0);

    const withNew = checkRatchet([old, neu], baseline, { minConfidence: "medium" });
    expect(withNew.newFindings.map((f) => f.fingerprint)).toEqual([neu.fingerprint]);
    expect(withNew.exitCode).toBe(1);
  });
});
