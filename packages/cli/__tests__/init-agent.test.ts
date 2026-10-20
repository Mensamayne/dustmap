/**
 * init --agent must preserve unmarked AGENTS.md content and be idempotent.
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
import { describe, expect, it } from "vitest";
import { BEGIN_MARK, END_MARK, upsertMarkedBlock } from "../src/init-agent.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const bin = path.join(repoRoot, "packages/cli/bin/dustmap.mjs");

function dustmap(args: string[], cwd: string) {
  return spawnSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
}

describe("dustmap init --agent", () => {
  it("keeps user AGENTS.md bytes outside markers; second run is a no-op", () => {
    const root = mkdtempSync(path.join(tmpdir(), "dustmap-agent-"));
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "agent-fixture", private: true }),
    );
    const userPreamble = "# My project\n\nUser-owned intro that must never change.\n";
    const userEpilogue = "\n## Local notes\n\nDo not touch this either.\n";
    writeFileSync(path.join(root, "AGENTS.md"), `${userPreamble}${userEpilogue}`);

    const first = dustmap(["init", "--agent", "codex", root], repoRoot);
    expect(first.status, first.stderr || first.stdout).toBe(0);

    const afterFirst = readFileSync(path.join(root, "AGENTS.md"), "utf8");
    expect(afterFirst.startsWith(userPreamble)).toBe(true);
    expect(afterFirst.endsWith(userEpilogue) || afterFirst.includes("## Local notes")).toBe(true);
    expect(afterFirst).toContain(BEGIN_MARK);
    expect(afterFirst).toContain(END_MARK);
    expect(afterFirst).toContain("dustmap_summary");

    // Bytes outside the marked block must match the original user prose.
    const start = afterFirst.indexOf(BEGIN_MARK);
    const end = afterFirst.indexOf(END_MARK) + END_MARK.length;
    const outside = afterFirst.slice(0, start) + afterFirst.slice(end);
    expect(outside.replace(/\s+/g, " ").trim()).toContain("User-owned intro that must never change");
    expect(outside).toContain("Local notes");

    const snapshot = afterFirst;
    const second = dustmap(["init", "--agent", "codex", root], repoRoot);
    expect(second.status, second.stderr || second.stdout).toBe(0);
    expect(second.stdout).toMatch(/zero changes|up to date/i);
    expect(readFileSync(path.join(root, "AGENTS.md"), "utf8")).toBe(snapshot);
  });

  it("upsertMarkedBlock leaves prefix/suffix intact", () => {
    const before = "AAA\n\nBBB\n";
    const once = upsertMarkedBlock(before, "BODY1");
    expect(once.startsWith("AAA")).toBe(true);
    expect(once).toContain("BBB");
    const twice = upsertMarkedBlock(once, "BODY2");
    expect(twice).toContain("BODY2");
    expect(twice).not.toContain("BODY1");
    expect(twice.startsWith("AAA")).toBe(true);
  });

  it("--dry does not write agent files", () => {
    const root = mkdtempSync(path.join(tmpdir(), "dustmap-agent-dry-"));
    mkdirSync(root, { recursive: true });
    writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "dry", private: true }));
    const r = dustmap(["init", "--agent", "claude", "--dry", root], repoRoot);
    expect(r.status, r.stderr || r.stdout).toBe(0);
    expect(r.stdout).toMatch(/dry-run/i);
    expect(existsSync(path.join(root, ".claude", "skills", "dustmap", "SKILL.md"))).toBe(false);
  });
});
