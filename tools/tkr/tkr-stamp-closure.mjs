#!/usr/bin/env node
/**
 * After agent:close, record gitProofSha in brief-history closure.
 * Usage: node tools/tkr/tkr-stamp-closure.mjs --id U20-02
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findGitProofForTask,
  loadTkrConfig,
  resolveRepoRoot,
  stampClosureGitProof,
} from "./lib/git-proof.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = resolveRepoRoot(path.resolve(__dirname, "../.."));

const args = process.argv.slice(2);
let taskId = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--id" && args[i + 1]) taskId = args[++i];
  else if (args[i].startsWith("--id=")) taskId = args[i].slice(5);
}

if (!taskId) process.exit(0);

const config = loadTkrConfig(root);
const proof = findGitProofForTask(root, taskId, config);
if (proof?.sha) {
  stampClosureGitProof(root, taskId, proof.sha, config);
}
