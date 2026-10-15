#!/usr/bin/env node
/**
 * TKR status report — queue vs git proof.
 * Usage: node tools/tkr/tkr-status.mjs [--json] [--missing-only]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findGitProofForTask,
  getWorktreeStatus,
  isTaskExempt,
  loadQueue,
  loadTkrConfig,
  resolveRepoRoot,
  verifyGateProof,
} from "./lib/git-proof.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = resolveRepoRoot(path.resolve(__dirname, "../.."));

const args = new Set(process.argv.slice(2));
const jsonOut = args.has("--json");
const missingOnly = args.has("--missing-only");

const config = loadTkrConfig(root);
const wt = getWorktreeStatus(root, config);
const queue = loadQueue(root, config);

const rows = [];
for (const task of queue.tasks) {
  if (task.status !== "done" && task.status !== "in_progress") continue;
  const exempt = isTaskExempt(root, task.id, config, task);
  const proof = exempt.exempt ? null : findGitProofForTask(root, task.id, config);
  const hasProof = exempt.exempt || Boolean(proof);
  if (missingOnly && hasProof) continue;
  rows.push({
    id: task.id,
    status: task.status,
    hasProof,
    exempt: exempt.exempt,
    exemptReason: exempt.reason,
    sha: proof?.shortSha ?? null,
    subject: proof?.subject ?? null,
  });
}

const gateIssues = [];
for (const task of queue.tasks) {
  if (task.status === "todo" || task.status === "cancelled") continue;
  for (const gateId of task.gates ?? []) {
    const r = verifyGateProof(root, gateId, config);
    if (!r.ok) {
      gateIssues.push({ taskId: task.id, gateId, reason: r.reason });
    }
  }
}

const report = {
  enabled: config.enabled,
  worktreeClean: wt.clean,
  dirtyLines: wt.lines?.length ?? 0,
  tasks: rows,
  gateIssues,
};

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`TKR enabled=${config.enabled} worktreeClean=${wt.clean}`);
  if (!wt.clean) {
    console.log(`Dirty files: ${wt.lines?.length ?? "?"}`);
  }
  console.log("");
  console.log("| ID | status | proof | sha |");
  console.log("|----|--------|-------|-----|");
  for (const r of rows) {
    const proofCol = r.exempt ? `exempt (${r.exemptReason})` : r.hasProof ? "yes" : "NO";
    console.log(`| ${r.id} | ${r.status} | ${proofCol} | ${r.sha ?? "-"} |`);
  }
  if (gateIssues.length > 0) {
    console.log("");
    console.log("Gate proof gaps:");
    for (const g of gateIssues.slice(0, 30)) {
      console.log(`- ${g.gateId} (needed by ${g.taskId}): ${g.reason}`);
    }
  }
}

process.exit(0);
