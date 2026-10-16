/**
 * Portability proof (DUST-12): npm-pack Dustmap packages, install into a temp
 * consumer, run init+scan on a Next fixture, assert the report matches the contract.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Report } from "@dustmap/contract";

const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const monorepoRoot = path.resolve(coreRoot, "../..");
const knipApp = path.join(coreRoot, "fixtures/knip-app");

function run(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env, FORCE_COLOR: "0" },
    windowsHide: true,
    shell: process.platform === "win32",
    maxBuffer: 32 * 1024 * 1024,
  });
  return r;
}

function npmPack(workspace: string, destDir: string): string {
  mkdirSync(destDir, { recursive: true });
  const out = execFileSync("npm", ["pack", "-w", workspace, "--pack-destination", destDir], {
    cwd: monorepoRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: true,
  });
  const line = out
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .at(-1);
  if (!line) throw new Error(`npm pack ${workspace} produced no tarball name`);
  const tgz = path.join(destDir, path.basename(line));
  if (!existsSync(tgz)) throw new Error(`packed tarball missing: ${tgz} (from ${out})`);
  return tgz;
}

describe("foreign repo install (npm pack)", () => {
  it(
    "init + scan on a Next fixture yields a valid report.json",
    () => {
      const stage = mkdtempSync(path.join(tmpdir(), "dustmap-foreign-"));
      const packs = path.join(stage, "packs");
      const consumer = path.join(stage, "consumer");
      mkdirSync(packs, { recursive: true });
      mkdirSync(consumer, { recursive: true });

      try {
        const contractTgz = npmPack("@dustmap/contract", packs);
        const coreTgz = npmPack("@dustmap/core", packs);
        const cliTgz = npmPack("@dustmap/cli", packs);

        writeFileSync(
          path.join(consumer, "package.json"),
          JSON.stringify(
            {
              name: "dustmap-foreign-consumer",
              private: true,
              type: "module",
              dependencies: {
                "@dustmap/contract": `file:${contractTgz}`,
                "@dustmap/core": `file:${coreTgz}`,
                "@dustmap/cli": `file:${cliTgz}`,
                tsx: "^4.21.0",
              },
            },
            null,
            2,
          ),
        );

        const install = run("npm", ["install", "--no-fund", "--no-audit"], consumer);
        expect(install.status, install.stderr || install.stdout).toBe(0);

        // Next-style fixture (knip-app already depends on next + app router files).
        const appDir = path.join(consumer, "app-under-test");
        cpSync(knipApp, appDir, { recursive: true });

        const dustmapBin = path.join(consumer, "node_modules", "@dustmap", "cli", "bin", "dustmap.mjs");
        expect(existsSync(dustmapBin)).toBe(true);

        const outDir = path.join(consumer, ".dustmap-out");

        const init = run(process.execPath, [dustmapBin, "init", appDir], consumer);
        expect(init.status, init.stderr || init.stdout).toBe(0);
        expect(existsSync(path.join(appDir, "dustmap.config.json"))).toBe(true);

        const scan = run(
          process.execPath,
          [dustmapBin, "scan", appDir, "--out", outDir],
          consumer,
        );
        expect(scan.status, scan.stderr || scan.stdout).toBe(0);

        const reportPath = path.join(outDir, "report.json");
        expect(existsSync(reportPath)).toBe(true);
        const report = Report.parse(JSON.parse(readFileSync(reportPath, "utf8")));
        expect(report.schema).toBe("dustmap.report/v1");
        expect(report.findings.length).toBeGreaterThan(0);
        expect(report.summary.byCategory["dead-code"] ?? 0).toBeGreaterThan(0);
      } finally {
        rmSync(stage, { recursive: true, force: true });
      }
    },
    300_000,
  );
});
