import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { directionText, openHistory, parseBlameMedian, parseFileBirths } from "./direction.js";

describe("copy direction from git history (DUP-05 L5)", () => {
  it("file births: oldest commit wins, renames carry the birth to the current name", () => {
    const raw = ["\u0001300", "M\tsrc/b.ts", "R100\tsrc/old.ts\tsrc/a.ts", "\u0001200", "A\tsrc/b.ts", "\u0001100", "A\tsrc/old.ts"].join("\n");
    const births = parseFileBirths(raw);
    expect(births.get("src/a.ts")).toBe(100);
    expect(births.get("src/b.ts")).toBe(200);
  });

  it("blame median ignores a few later edits", () => {
    const line = (sha: string, n: number) => `${sha} ${n} ${n} 1`;
    const raw = [line("a".repeat(40), 1), "author-time 100", "\tx", line("a".repeat(40), 2), "\ty", line("b".repeat(40), 3), "author-time 900", "\tz"].join("\n");
    expect(parseBlameMedian(raw)).toBe(100);
  });

  const dir = mkdtempSync(path.join(tmpdir(), "dustmap-direction-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("a real repository: the older file is the original; no history → no direction", () => {
    const git = (args: string[], date: string) =>
      execFileSync("git", args, { cwd: dir, env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }, stdio: "ignore" });
    git(["init", "-q"], "2026-01-01T00:00:00Z");
    git(["config", "user.email", "t@example.com"], "2026-01-01T00:00:00Z");
    git(["config", "user.name", "t"], "2026-01-01T00:00:00Z");
    writeFileSync(path.join(dir, "a.ts"), "export const a = 1;\n");
    git(["add", "."], "2026-01-01T00:00:00Z");
    git(["commit", "-q", "-m", "a"], "2026-01-01T00:00:00Z");
    writeFileSync(path.join(dir, "b.ts"), "export const a = 1;\n");
    git(["add", "."], "2026-01-11T00:00:00Z");
    git(["commit", "-q", "-m", "b"], "2026-01-11T00:00:00Z");
    const members = [
      { path: "b.ts", startLine: 1, endLine: 1, symbol: "b" },
      { path: "a.ts", startLine: 1, endLine: 1, symbol: "a" },
    ];
    const d = openHistory(dir).direction(members);
    expect(d?.original).toBe(1);
    expect(directionText(members, d!)).toBe("oldest: a (a.ts:1), 2026-01-01 (its file); copies: b (b.ts:1) 10 days later (its file)");
    expect(openHistory(path.join(dir, "missing")).direction(members)).toBeNull();
  });
});
