/**
 * Git-signals: real temp repo for counters; cache hit on second history load (diff mode).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AdapterContext } from "../src/adapter.js";
import { defaultConfig } from "../src/config/load.js";
import {
  gitSignalsAdapter,
  gitSignalsLastStats,
  loadGitLogCached,
  parseGitSignalThresholds,
  readGitLog,
} from "../src/signals/git/index.js";

function git(cwd: string, args: string[]): void {
  execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
}

function buildRepo(): string {
  const root = mkdtempSync(path.join(tmpdir(), "dustmap-git-sig-"));
  git(root, ["init"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test"]);
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, "src/a.ts"), "export const a = 1;\n");
  writeFileSync(path.join(root, "src/b.ts"), "export const b = 1;\n");
  writeFileSync(path.join(root, "src/c.ts"), "export const c = 1;\n");

  for (let i = 1; i <= 8; i++) {
    writeFileSync(path.join(root, "src/a.ts"), `export const a = ${i};\n`);
    writeFileSync(path.join(root, "src/b.ts"), `export const b = ${i};\n`);
    git(root, ["add", "src/a.ts", "src/b.ts"]);
    git(root, ["commit", "-m", `feat: pair ${i}`]);
  }
  writeFileSync(path.join(root, "src/a.ts"), "export const a = 99;\n");
  git(root, ["add", "src/a.ts"]);
  git(root, ["commit", "-m", "feat: only a"]);
  writeFileSync(path.join(root, "src/a.ts"), "export const a = 100;\n");
  git(root, ["add", "src/a.ts"]);
  git(root, ["commit", "-m", "fix: a again"]);

  return root;
}

function ctxFor(repoRoot: string, outputDir: string, mode: "full" | "diff" = "full"): AdapterContext {
  const files = ["src/a.ts", "src/b.ts", "src/c.ts"];
  const roles = new Map(files.map((f) => [f, "source" as const]));
  const config = {
    ...defaultConfig(),
    outputDir,
    adapters: {
      "git-signals": {
        enabled: true,
        options: {
          since: "10 years ago",
          coChangeMinSupport: 5,
          coChangeMinConfidencePct: 60,
          hotspotMinScore: 1000,
          fixDensityMinCommits: 2,
          fixDensityMinRatio: 0.05,
          massCommitFileLimit: 40,
        },
      },
    },
  };
  return {
    repoRoot,
    files,
    roles,
    filesWithRole: (...wanted) => files.filter((f) => wanted.includes(roles.get(f)!)),
    config,
    mode,
    readFile: async (rel) => {
      const { readFileSync } = await import("node:fs");
      return readFileSync(path.join(repoRoot, rel), "utf8");
    },
  };
}

describe("git-signals integration", () => {
  it("reads expected co-change counters from a real git fixture", () => {
    const root = buildRepo();
    const log = readGitLog(root, { since: "10 years ago", massCommitFileLimit: 40 });
    expect(log.commits.length).toBe(10);
    const withBoth = log.commits.filter(
      (c) => c.files.includes("src/a.ts") && c.files.includes("src/b.ts"),
    );
    expect(withBoth).toHaveLength(8);
  });

  it("adapter emits co-change; second cached load does not re-run git log", async () => {
    const root = buildRepo();
    const out = mkdtempSync(path.join(tmpdir(), "dustmap-git-out-"));
    const thresholds = parseGitSignalThresholds({
      since: "10 years ago",
      massCommitFileLimit: 40,
    });

    const first = loadGitLogCached(root, out, thresholds);
    expect(first.stats.ranGitLog).toBe(true);
    expect(first.stats.hit).toBe(false);

    const second = loadGitLogCached(root, out, thresholds);
    expect(second.stats.hit).toBe(true);
    expect(second.stats.ranGitLog).toBe(false);
    expect(second.log.commits.length).toBe(first.log.commits.length);

    const findings = await gitSignalsAdapter().run(ctxFor(root, out, "diff"));
    expect(gitSignalsLastStats.hit).toBe(true);
    expect(gitSignalsLastStats.ranGitLog).toBe(false);
    const co = findings.find((f) => f.kind === "co-change");
    expect(co).toBeDefined();
    expect(co!.evidence.find((e) => e.label === "confidence")?.value).toBe("80%");
  });
});
