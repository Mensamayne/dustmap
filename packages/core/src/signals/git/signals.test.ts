import { describe, expect, it } from "vitest";
import type { ParsedGitLog } from "./log.js";
import { buildGitFindings } from "./signals.js";
import { DEFAULT_GIT_SIGNAL_THRESHOLDS } from "./thresholds.js";

function logWithAB(): ParsedGitLog {
  const commits = [];
  for (let i = 1; i <= 8; i++) {
    commits.push({ sha: `s${i}`, subject: `feat: together ${i}`, files: ["src/a.ts", "src/b.ts"] });
  }
  commits.push({ sha: "s9", subject: "feat: only a", files: ["src/a.ts"] });
  commits.push({ sha: "s10", subject: "feat: only a again", files: ["src/a.ts"] });
  return { commits, skippedMerges: 0, skippedMass: 0, renames: {} };
}

describe("buildGitFindings", () => {
  it("emits co-change with 80% shared changes when A+B share 8 of 10 relevant commits", () => {
    const findings = buildGitFindings(
      logWithAB(),
      {
        ...DEFAULT_GIT_SIGNAL_THRESHOLDS,
        coChangeMinSupport: 5,
        coChangeMinConfidencePct: 60,
        hotspotMinScore: 10_000,
        fixDensityMinRatio: 1,
      },
      new Map(),
    );
    const co = findings.find((f) => f.kind === "co-change");
    expect(co).toBeDefined();
    expect(co!.evidence.find((e) => e.label === "shared-commits")?.value).toBe("8");
    expect(co!.evidence.find((e) => e.label === "confidence")?.value).toBe("80%");
    expect(co!.evidence.find((e) => e.label === "summary")?.value).toContain("80%");
    expect(co!.locations.map((l) => l.path).sort()).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("emits hotspot from changes × complexity", () => {
    const log: ParsedGitLog = {
      commits: Array.from({ length: 10 }, (_, i) => ({
        sha: `h${i}`,
        subject: "feat",
        files: ["hot.ts"],
      })),
      skippedMerges: 0,
      skippedMass: 0,
      renames: {},
    };
    const findings = buildGitFindings(
      log,
      { ...DEFAULT_GIT_SIGNAL_THRESHOLDS, hotspotMinScore: 40, coChangeMinSupport: 100 },
      new Map([["hot.ts", { maxCyclomatic: 5 }]]),
    );
    // score = 10 * 5 = 50
    const hot = findings.find((f) => f.kind === "hotspot");
    expect(hot).toBeDefined();
    expect(hot!.evidence.find((e) => e.label === "score")?.value).toBe("50");
  });

  it("emits fix-density when fix commits dominate", () => {
    const commits = [];
    for (let i = 0; i < 4; i++) {
      commits.push({ sha: `f${i}`, subject: `fix: bug ${i}`, files: ["fragile.ts"] });
    }
    commits.push({ sha: "n1", subject: "feat: ok", files: ["fragile.ts"] });
    const findings = buildGitFindings(
      { commits, skippedMerges: 0, skippedMass: 0, renames: {} },
      {
        ...DEFAULT_GIT_SIGNAL_THRESHOLDS,
        fixDensityMinCommits: 5,
        fixDensityMinRatio: 0.4,
        hotspotMinScore: 10_000,
        coChangeMinSupport: 100,
      },
      new Map(),
    );
    const fd = findings.find((f) => f.kind === "fix-density");
    expect(fd).toBeDefined();
    expect(fd!.evidence.find((e) => e.label === "fix-ratio")?.value).toBe("0.80");
  });
});
