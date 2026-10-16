/**
 * Real-bin e2e: dustmap scan → summary on knip-app fixture must surface a Knip finding.
 * Spawns packages/cli/bin/dustmap.mjs (no in-process CLI import as proof).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Report } from "@dustmap/contract";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const bin = path.join(repoRoot, "packages/cli/bin/dustmap.mjs");
const knipApp = path.join(repoRoot, "packages/core/fixtures/knip-app");

function dustmap(args: string[], cwd = repoRoot) {
  return spawnSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
}

describe("dustmap CLI e2e (real bin)", () => {
  it("scan then summary shows a Knip dead-code finding", () => {
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-cli-e2e-"));
    const scan = dustmap(["scan", knipApp, "--out", out]);
    expect(scan.status, scan.stderr || scan.stdout).toBe(0);
    expect(scan.stdout).toMatch(/findings/i);
    expect(scan.stdout).toMatch(/dalej:\s*dustmap summary/);

    const report = Report.parse(JSON.parse(readFileSync(path.join(out, "report.json"), "utf8")));
    expect(report.summary.byCategory["dead-code"]).toBeGreaterThan(0);
    expect(report.findings.some((f) => f.source === "knip" || f.kind.startsWith("unused-"))).toBe(
      true,
    );

    const summary = dustmap(["summary", "--out", out]);
    expect(summary.status, summary.stderr || summary.stdout).toBe(0);
    expect(summary.stdout).toMatch(/dead-code:\s*\d+/);
    expect(summary.stdout).toMatch(/dalej:/);
  });

  it("summary without a report exits 2", () => {
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-cli-empty-"));
    const summary = dustmap(["summary", "--out", out]);
    expect(summary.status).toBe(2);
    expect(summary.stderr).toMatch(/No report\.json|report\.json/);
  });

  it("unknown command exits 2", () => {
    const r = dustmap(["nope"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/Unknown command/);
  });
});
