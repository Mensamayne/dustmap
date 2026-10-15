#!/usr/bin/env node
/**
 * TKR readiness check before agent:next / agent:next-bug.
 * Usage: node tools/tkr/tkr-check-ready.mjs [--task-id U20-02] [--json]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkReadyForNext,
  loadTkrConfig,
  resolveRepoRoot,
} from "./lib/git-proof.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = resolveRepoRoot(path.resolve(__dirname, "../.."));

const args = process.argv.slice(2);
let taskId = "";
let jsonOut = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--task-id" && args[i + 1]) taskId = args[++i];
  else if (a === "--json") jsonOut = true;
  else if (a.startsWith("--task-id=")) taskId = a.slice(10);
}

if (process.env.TKR_SKIP === "1") {
  if (jsonOut) console.log(JSON.stringify({ ok: true, skipped: true }));
  else console.log("TKR_SKIP=1");
  process.exit(0);
}

const config = loadTkrConfig(root);
const result = checkReadyForNext(root, { config, taskId: taskId || undefined });

if (jsonOut) {
  console.log(JSON.stringify(result, null, 2));
} else if (result.ok) {
  console.log("TKR_READY=ok");
  if (taskId) console.log(`GATES_OK=${taskId}`);
} else {
  console.error("TKR_READY=blocked");
  for (const f of result.failures ?? []) {
    console.error(`- [${f.code}] ${f.reason ?? f.taskId ?? ""}`);
    if (f.failures) {
      for (const g of f.failures) {
        console.error(`  gate ${g.gateId}: ${g.reason}`);
      }
    }
    if (f.lines?.length) {
      for (const line of f.lines) console.error(`  ${line}`);
    }
  }
}

process.exit(result.ok ? 0 : 1);
