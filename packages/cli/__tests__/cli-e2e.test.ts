/**
 * Real-bin e2e: dustmap scan → summary on knip-app fixture must surface a Knip finding.
 * Spawns packages/cli/bin/dustmap.mjs (no in-process CLI import as proof).
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

  it("summary without git HEAD says freshness cannot be confirmed", () => {
    const root = mkdtempSync(path.join(tmpdir(), "dustmap-cli-nohead-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "cli-nohead", private: true }),
    );
    const init = spawnSync("git", ["init"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    expect(init.status, init.stderr).toBe(0);

    const out = path.join(root, ".dustmap");
    mkdirSync(out, { recursive: true });
    writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify({
        schema: "dustmap.report/v1",
        scan: {
          mode: "full",
          commit: "dddddddddddddddddddddddddddddddddddddddd",
          startedAt: "2026-10-15T12:00:00.000Z",
          tools: [{ name: "knip", version: "5.0.0" }],
        },
        summary: { byCategory: {}, topPlaces: [] },
        findings: [],
      }),
    );

    const summary = dustmap(["summary", "--out", out], root);
    expect(summary.status, summary.stderr || summary.stdout).toBe(0);
    expect(summary.stdout).toMatch(/Cannot confirm freshness|HEAD unavailable/i);

    const json = dustmap(["summary", "--out", out, "--json"], root);
    expect(json.status, json.stderr || json.stdout).toBe(0);
    const body = JSON.parse(json.stdout);
    expect(body.stale).toBe("unknown");
    expect(body.headAvailable).toBe(false);
    expect(body.staleWarning).toMatch(/HEAD is unavailable/i);
  });

  it("summary from another repo judges freshness against the scanned repo (BUG-09)", () => {
    const gitRepo = (name: string) => {
      const root = mkdtempSync(path.join(tmpdir(), `dustmap-cli-${name}-`));
      mkdirSync(path.join(root, "src"), { recursive: true });
      writeFileSync(path.join(root, "package.json"), JSON.stringify({ name, private: true, type: "module" }));
      writeFileSync(path.join(root, "src", "index.ts"), `export const ${name} = 1;\n`);
      for (const args of [["init"], ["add", "."], ["-c", "user.email=t@d.test", "-c", "user.name=t", "commit", "-m", "init"]]) {
        const r = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
        expect(r.status, r.stderr).toBe(0);
      }
      return root;
    };
    const scanned = gitRepo("scanned");
    const elsewhere = gitRepo("elsewhere");
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-cli-target-out-"));
    expect(dustmap(["scan", scanned, "--out", out]).status).toBe(0);

    const json = dustmap(["summary", "--out", out, "--json"], elsewhere);
    expect(json.status, json.stderr || json.stdout).toBe(0);
    expect(JSON.parse(json.stdout).stale).toBe(false);
  });
});
