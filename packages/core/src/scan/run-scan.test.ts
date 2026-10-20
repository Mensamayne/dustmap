import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runInit } from "../init/run-init.js";
import {
  countingAdapter,
  singleFileAdapter,
  throwingAdapter,
} from "../test-support/fake-adapters.js";
import { isOutsideRepo, runScan, snapshotRepoPaths } from "./run-scan.js";

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

function initGitRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "dustmap-scan-"));
  git(root, ["init"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test"]);
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "scan-fix" }), "utf8");
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, "src", "a.ts"), "export const a = 1;\n", "utf8");
  writeFileSync(
    path.join(root, "src", "b.ts"),
    "import { a } from './a';\nexport const b = a;\n",
    "utf8",
  );
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "init"]);
  return root;
}

describe("runScan", () => {
  it("writes only under an outputDir outside the repo", async () => {
    const root = initGitRepo();
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-out-"));
    const before = snapshotRepoPaths(root);
    const adapter = countingAdapter("fake");
    const result = await runScan({
      repoRoot: root,
      mode: "full",
      adapters: [adapter],
      outputDir: out,
    });
    expect(isOutsideRepo(root, result.outputDir)).toBe(true);
    expect(existsSync(path.join(out, "report.json"))).toBe(true);
    expect(existsSync(path.join(root, ".dustmap"))).toBe(false);
    expect(snapshotRepoPaths(root)).toEqual(before);
    expect(adapter.runs).toBe(1);
  });

  it("second full scan hits cache and does not re-run adapters", async () => {
    const root = initGitRepo();
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-out-"));
    const adapter = countingAdapter("fake");
    const first = await runScan({
      repoRoot: root,
      mode: "full",
      adapters: [adapter],
      outputDir: out,
    });
    expect(first.adapterRuns).toBe(1);
    expect(first.report.scan.cache?.misses).toBeGreaterThan(0);

    const second = await runScan({
      repoRoot: root,
      mode: "full",
      adapters: [adapter],
      outputDir: out,
    });
    expect(second.adapterRuns).toBe(0);
    expect(adapter.runs).toBe(1);
    expect(second.report.scan.cache?.hits).toBeGreaterThan(0);
    expect(second.report.findings.length).toBe(first.report.findings.length);
  });

  it("records adapter errors and keeps findings from healthy adapters", async () => {
    const root = initGitRepo();
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-out-"));
    const ok = countingAdapter("ok");
    const bad = throwingAdapter("boom", "adapter exploded");
    const result = await runScan({
      repoRoot: root,
      mode: "full",
      adapters: [bad, ok],
      outputDir: out,
    });
    const boom = result.report.scan.tools.find((t) => t.name === "boom");
    expect(boom?.error).toMatch(/adapter exploded/);
    expect(result.report.findings.length).toBeGreaterThan(0);
    expect(result.report.scan.tools.some((t) => t.name === "ok" && !t.error)).toBe(true);
  });

  it("diff mode only sees touched files (and import neighbors)", async () => {
    const root = initGitRepo();
    const base = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    writeFileSync(path.join(root, "src", "b.ts"), "import { a } from './a';\nexport const b = 2;\n", "utf8");
    git(root, ["add", "src/b.ts"]);
    git(root, ["commit", "-m", "change b"]);

    const out = mkdtempSync(path.join(tmpdir(), "dustmap-out-"));
    const adapter = singleFileAdapter("only-a", "src/a.ts", "aOnly");
    const alsoB = singleFileAdapter("only-b", "src/b.ts", "bOnly");
    const result = await runScan({
      repoRoot: root,
      mode: "diff",
      baseRef: base,
      adapters: [adapter, alsoB],
      outputDir: out,
    });
    // b changed; neighbor a is pulled in via import expand
    expect(result.filesScanned).toEqual(expect.arrayContaining(["src/a.ts", "src/b.ts"]));
    const fps = result.report.findings.map((f) => f.locations[0]?.path);
    expect(fps).toContain("src/b.ts");
    expect(fps).toContain("src/a.ts");
  });

  it("diff scan writes report.diff.json and leaves the full map untouched (BUG-03)", async () => {
    const root = initGitRepo();
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-out-"));
    const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    // c.ts is outside any later diff: its finding must survive in the map.
    writeFileSync(path.join(root, "src", "c.ts"), "export const c = 3;\n", "utf8");
    git(root, ["add", "src/c.ts"]);
    git(root, ["commit", "-m", "add c"]);
    const adapters = () => [
      singleFileAdapter("only-b", "src/b.ts", "bOnly"),
      singleFileAdapter("only-c", "src/c.ts", "cOnly"),
    ];
    const full = await runScan({ repoRoot: root, mode: "full", adapters: adapters(), outputDir: out });
    expect(full.reportPath).toBe(path.join(out, "report.json"));
    const mapBefore = readFileSync(path.join(out, "report.json"), "utf8");

    writeFileSync(path.join(root, "src", "b.ts"), "import { a } from './a';\nexport const b = 22;\n", "utf8");
    git(root, ["add", "src/b.ts"]);
    git(root, ["commit", "-m", "change b"]);
    const diff = await runScan({
      repoRoot: root,
      mode: "diff",
      baseRef: base,
      adapters: adapters(),
      outputDir: out,
    });

    expect(diff.reportPath).toBe(path.join(out, "report.diff.json"));
    expect(readFileSync(path.join(out, "report.json"), "utf8")).toBe(mapBefore);
    expect(full.report.findings.map((f) => f.locations[0]?.path)).toContain("src/c.ts");
    const diffReport = JSON.parse(readFileSync(path.join(out, "report.diff.json"), "utf8")) as {
      scan: { mode: string; baseRef?: string };
    };
    expect(diffReport.scan.mode).toBe("diff");
    expect(diffReport.scan.baseRef).toBe(base);
  });

  it("init writes config once and never overwrites", () => {
    const root = mkdtempSync(path.join(tmpdir(), "dustmap-init-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "x", dependencies: { next: "15.0.0" } }),
      "utf8",
    );
    mkdirSync(path.join(root, "app"), { recursive: true });
    writeFileSync(path.join(root, "app", "page.tsx"), "export default function P(){return null}", "utf8");
    const first = runInit(root);
    expect(first.wrote).toBe(true);
    const marked = JSON.parse(readFileSync(first.configPath, "utf8")) as {
      entryPoints: string[];
    };
    marked.entryPoints = ["KEEP_ME_UNIQUE_MARKER"];
    writeFileSync(first.configPath, `${JSON.stringify(marked, null, 2)}\n`, "utf8");
    const second = runInit(root);
    expect(second.wrote).toBe(false);
    expect(readFileSync(first.configPath, "utf8")).toContain("KEEP_ME_UNIQUE_MARKER");
  });
});
