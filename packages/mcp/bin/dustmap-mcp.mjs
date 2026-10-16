#!/usr/bin/env node
/**
 * Dustmap MCP entry — loads TypeScript main via tsx (stdio transport).
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(here, "..", "src", "main.ts");
const require = createRequire(import.meta.url);

function resolveTsxCli() {
  try {
    return require.resolve("tsx/cli");
  } catch {
    /* fall through */
  }
  const candidates = [
    path.join(here, "..", "node_modules", "tsx", "dist", "cli.mjs"),
    path.join(here, "..", "..", "..", "node_modules", "tsx", "dist", "cli.mjs"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error("Could not resolve tsx/cli — install tsx in the workspace");
}

const tsxCli = resolveTsxCli();
const result = spawnSync(process.execPath, [tsxCli, entry, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  windowsHide: true,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status === null ? 1 : result.status);
