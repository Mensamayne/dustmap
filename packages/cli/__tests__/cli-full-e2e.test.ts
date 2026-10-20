/**
 * Real-bin e2e: init → scan → summary → list → decide → scan (muted finding gone).
 * Also markdown snapshot shape + SARIF schema validation.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv-draft-04";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { Report, toSarif } from "@dustmap/contract";
import { reportToMarkdown } from "../src/export/markdown.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const bin = path.join(repoRoot, "packages/cli/bin/dustmap.mjs");
const sarifSchema = path.join(
  repoRoot,
  "packages/contract/test/fixtures/sarif-schema-2.1.0.json",
);

function dustmap(args: string[], cwd: string) {
  return spawnSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
  });
}

function miniRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "dustmap-cli-full-"));
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "cli-full-fixture", private: true, type: "module" }),
  );
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, "src", "used.ts"), "export const used = 1;\n");
  writeFileSync(path.join(root, "src", "dead.ts"), "export const dead = 2;\n");
  writeFileSync(
    path.join(root, "src", "index.ts"),
    "import { used } from './used.js';\nexport const main = () => used;\n",
  );
  return root;
}

describe("dustmap CLI full loop (real bin)", () => {
  it("init → scan → summary → decide keep → scan hides the finding", () => {
    const root = miniRepo();
    const out = path.join(root, ".dustmap-out");

    const init = dustmap(["init", root], repoRoot);
    expect(init.status, init.stderr || init.stdout).toBe(0);
    expect(existsSync(path.join(root, "dustmap.config.json"))).toBe(true);

    const scan1 = dustmap(["scan", root, "--out", out], repoRoot);
    expect(scan1.status, scan1.stderr || scan1.stdout).toBe(0);
    const report1 = Report.parse(JSON.parse(readFileSync(path.join(out, "report.json"), "utf8")));
    expect(report1.findings.length).toBeGreaterThan(0);

    const target =
      report1.findings.find((f) => f.locations.some((l) => l.path.includes("dead"))) ??
      report1.findings[0]!;
    const fp = target.fingerprint;

    const summary = dustmap(["summary", "--out", out], repoRoot);
    expect(summary.status, summary.stderr || summary.stdout).toBe(0);

    const list = dustmap(["list", "--category", "dead-code", "--min-confidence", "high", "--json", "--out", out], repoRoot);
    expect(list.status, list.stderr || list.stdout).toBe(0);
    const page = JSON.parse(list.stdout) as {
      total: number;
      items: { category: string; confidence: string; fingerprint: string }[];
    };
    const expectedHigh = report1.findings.filter(
      (f) => f.category === "dead-code" && f.confidence === "high",
    );
    expect(expectedHigh.length).toBeGreaterThan(0);
    expect(page.total).toBe(expectedHigh.length);
    expect(page.items.every((i) => i.category === "dead-code" && i.confidence === "high")).toBe(true);

    const listText = dustmap(["list", "--limit", "1", "--out", out], repoRoot);
    expect(listText.status, listText.stderr || listText.stdout).toBe(0);
    expect(listText.stdout).toMatch(/^dalej: /m);

    const badList = dustmap(["list", "--min-confidence", "certain", "--out", out], repoRoot);
    expect(badList.status).toBe(2);
    expect(badList.stderr).toMatch(/low, medium, high/);

    const show = dustmap(["show", fp, "--out", out], repoRoot);
    expect(show.status, show.stderr || show.stdout).toBe(0);
    expect(show.stdout).toContain(fp);

    const decide = dustmap(
      [
        "decide",
        fp,
        "keep",
        "--reason",
        "Kept on purpose for the CLI e2e mute path.",
        "--out",
        out,
      ],
      repoRoot,
    );
    expect(decide.status, decide.stderr || decide.stdout).toBe(0);
    expect(existsSync(path.join(out, "decisions.yml"))).toBe(true);

    const scan2 = dustmap(["scan", root, "--out", out], repoRoot);
    expect(scan2.status, scan2.stderr || scan2.stdout).toBe(0);
    const report2 = Report.parse(JSON.parse(readFileSync(path.join(out, "report.json"), "utf8")));
    expect(report2.findings.some((f) => f.fingerprint === fp)).toBe(false);
  });

  it("scan --diff writes report.diff.json; the map and its readers stay full (BUG-03)", () => {
    const root = miniRepo();
    const git = (args: string[]) => {
      const r = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
      expect(r.status, r.stderr).toBe(0);
    };
    git(["init"]);
    git(["config", "user.email", "cli@dustmap.test"]);
    git(["config", "user.name", "Dustmap CLI"]);
    git(["add", "."]);
    git(["commit", "-m", "init"]);
    const out = path.join(root, ".dustmap-out");
    expect(dustmap(["init", root], repoRoot).status).toBe(0);
    expect(dustmap(["scan", root, "--out", out], repoRoot).status).toBe(0);
    const mapBytes = readFileSync(path.join(out, "report.json"), "utf8");
    const mapCount = Report.parse(JSON.parse(mapBytes)).findings.length;

    writeFileSync(path.join(root, "src", "orphan.ts"), "export const orphan = 3;\n");
    git(["add", "."]);
    git(["commit", "-m", "orphan"]);
    const scanDiff = dustmap(["scan", root, "--diff", "HEAD~1", "--out", out], repoRoot);
    expect(scanDiff.status, scanDiff.stderr || scanDiff.stdout).toBe(0);
    expect(scanDiff.stdout).toMatch(/full map \(report\.json\) is unchanged/);
    expect(readFileSync(path.join(out, "report.json"), "utf8")).toBe(mapBytes);

    const summary = dustmap(["summary", "--json", "--out", out], repoRoot);
    expect(summary.status, summary.stderr).toBe(0);
    expect((JSON.parse(summary.stdout) as { findingCount: number }).findingCount).toBe(mapCount);

    const diffSummary = dustmap(["summary", "--report", "diff", "--out", out], repoRoot);
    expect(diffSummary.status, diffSummary.stderr).toBe(0);
    expect(diffSummary.stdout).toMatch(/^Diff report vs HEAD~1/m);

    const diffList = dustmap(["list", "--report", "diff", "--json", "--out", out], repoRoot);
    expect(diffList.status, diffList.stderr).toBe(0);
    const items = (JSON.parse(diffList.stdout) as { items: { path?: string }[] }).items;
    expect(items.some((i) => i.path === "src/orphan.ts")).toBe(true);

    const sarifFile = path.join(out, "diff.sarif.json");
    const exp = dustmap(["export", "--to", "sarif", "--report", "diff", "--file", sarifFile, "--out", out], repoRoot);
    expect(exp.status, exp.stderr).toBe(0);
    expect(readFileSync(sarifFile, "utf8")).toContain("src/orphan.ts");

    expect(dustmap(["ratchet", "--update-baseline", "--report", "diff", "--out", out], repoRoot).status).toBe(2);
    expect(dustmap(["summary", "--report", "partial", "--out", out], repoRoot).status).toBe(2);
  });

  it("export markdown has stable sections; SARIF validates", () => {
    const root = miniRepo();
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-export-"));
    const scan = dustmap(["scan", root, "--out", out], repoRoot);
    expect(scan.status, scan.stderr || scan.stdout).toBe(0);
    const report = Report.parse(JSON.parse(readFileSync(path.join(out, "report.json"), "utf8")));

    const md = reportToMarkdown(report);
    expect(md).toMatch(/^# Dustmap report/m);
    expect(md).toMatch(/## Summary by category/);
    expect(md).toMatch(/## Top places/);
    expect(md).toMatch(/## Findings by category/);
    expect(md).toMatch(/report-only/i);
    // Timestamps move; snapshot the stable body only.
    const stable = md.replace(/· \d{4}-\d{2}-\d{2}T[^`\n]+/, "· <timestamp>");
    expect(stable).toMatchSnapshot();

    const file = path.join(out, "report.sarif.json");
    const exp = dustmap(["export", "--to", "sarif", "--out", out, "--file", file], repoRoot);
    expect(exp.status, exp.stderr || exp.stdout).toBe(0);
    const sarif = JSON.parse(readFileSync(file, "utf8"));
    const fromContract = toSarif(report);
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0].results.length).toBe(fromContract.runs[0]!.results.length);

    const ajv = new Ajv({ strict: false, validateFormats: true });
    addFormats(ajv);
    const schema = JSON.parse(readFileSync(sarifSchema, "utf8"));
    const validate = ajv.compile(schema);
    expect(validate(sarif), JSON.stringify(validate.errors)).toBe(true);
  });

  it("ratchet exits 1 on new findings then 0 after baseline update", () => {
    const root = miniRepo();
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-ratchet-"));
    expect(dustmap(["scan", root, "--out", out], repoRoot).status).toBe(0);

    const first = dustmap(["ratchet", "--out", out], repoRoot);
    expect(first.status).toBe(1);

    const update = dustmap(["ratchet", "--update-baseline", "--out", out], repoRoot);
    expect(update.status, update.stderr || update.stdout).toBe(0);

    const second = dustmap(["ratchet", "--out", out], repoRoot);
    expect(second.status, second.stderr || second.stdout).toBe(0);
  });
});
