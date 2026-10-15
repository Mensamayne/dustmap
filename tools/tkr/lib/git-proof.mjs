#!/usr/bin/env node
/**
 * TKR — Token Reducer git proof library.
 * SSOT for task completion is git history, not queue.json alone.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const DEFAULT_CONFIG = {
  version: 1,
  enabled: true,
  queuePath: "docs/agent-briefs/queue.json",
  historyPath: "docs/agent-continue/brief-history.json",
  commitPatterns: [
    "Fixes {id}",
    "Closes {id}",
    "Fix {id}",
    "Resolves {id}",
    "TKR-{id}",
  ],
  requireGitProofOnClose: true,
  requireGitProofForGates: false,
  requireCleanWorktreeOnNext: true,
  logScanLimit: 8000,
  exemptTaskIds: [],
};

/** @param {string} root */
export function resolveRepoRoot(root) {
  return path.resolve(root);
}

/** @param {string} root */
export function loadTkrConfig(root) {
  const configPath = path.join(root, "tools/tkr/tkr-config.json");
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG, configPath: null, enabled: false };
  }
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return { ...DEFAULT_CONFIG, ...raw, configPath };
}

/** @param {string} root @param {string} rel */
function readJson(root, rel) {
  const p = path.join(root, rel.replace(/\//g, path.sep));
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

/** @param {string} cwd @param {string[]} args */
function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trimEnd();
}

/** @param {string} taskId @param {object} config */
export function buildCommitNeedles(taskId, config) {
  const patterns = config.commitPatterns ?? DEFAULT_CONFIG.commitPatterns;
  const needles = [];
  for (const pattern of patterns) {
    needles.push(pattern.replace(/\{id\}/g, taskId));
  }
  // Bare task id in message (word boundary) — e.g. "U20-02" or "BH-101"
  needles.push(taskId);
  return [...new Set(needles)];
}

/**
 * @param {string} haystack
 * @param {string} taskId
 * @param {string[]} needles
 */
function messageMatchesTask(haystack, taskId, needles) {
  const text = haystack.toLowerCase();
  const idLower = taskId.toLowerCase();
  for (const needle of needles) {
    const n = needle.toLowerCase();
    if (n === idLower) {
      const re = new RegExp(`\\b${escapeRegExp(idLower)}\\b`, "i");
      if (re.test(haystack)) return true;
    } else if (text.includes(n)) {
      return true;
    }
  }
  return false;
}

/** @param {string} s */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let _logCache = null;

/** @param {string} root @param {object} config */
function loadGitLog(root, config) {
  if (_logCache) return _logCache;
  const limit = config.logScanLimit ?? DEFAULT_CONFIG.logScanLimit;
  const raw = git(root, [
    "log",
    "--format=%H%x1f%s%x1f%b%x1e",
    `-n${limit}`,
  ]);
  const entries = [];
  for (const chunk of raw.split("\x1e")) {
    if (!chunk.trim()) continue;
    const parts = chunk.split("\x1f");
    if (parts.length < 2) continue;
    entries.push({
      sha: parts[0].trim(),
      subject: (parts[1] ?? "").trim(),
      body: (parts[2] ?? "").trim(),
    });
  }
  _logCache = entries;
  return entries;
}

/** Reset log cache (tests). */
export function resetGitLogCache() {
  _logCache = null;
}

/**
 * @param {string} root
 * @param {string} taskId
 * @param {object} config
 */
export function findGitProofForTask(root, taskId, config) {
  const needles = buildCommitNeedles(taskId, config);
  for (const entry of loadGitLog(root, config)) {
    const blob = `${entry.subject}\n${entry.body}`;
    if (messageMatchesTask(blob, taskId, needles)) {
      return {
        sha: entry.sha,
        shortSha: entry.sha.slice(0, 7),
        subject: entry.subject,
      };
    }
  }
  return null;
}

/**
 * @param {string} root
 * @param {string} taskId
 * @param {object} config
 */
export function readClosure(root, taskId, config) {
  const history = readJson(root, config.historyPath);
  if (!history?.closures?.[taskId]) return null;
  return history.closures[taskId];
}

/**
 * @param {string} root
 * @param {string} taskId
 * @param {object} config
 * @param {object|null} task
 */
export function isTaskExempt(root, taskId, config, task = null) {
  const exempt = new Set(config.exemptTaskIds ?? []);
  if (exempt.has(taskId)) {
    return { exempt: true, reason: "listed in exemptTaskIds" };
  }
  const closure = readClosure(root, taskId, config);
  if (closure?.gitProofSha) {
    return { exempt: true, reason: "closure already stores gitProofSha" };
  }
  if (closure?.backfill === true) {
    return { exempt: true, reason: "backfill closure (pre-TKR)" };
  }
  if (closure && closure.backfill !== true && !closure.gitProofSha) {
    return { exempt: true, reason: "closure without gitProofSha (pre-TKR rollout)" };
  }
  if (closure?.tkrExempt === true) {
    return { exempt: true, reason: "closure marked tkrExempt" };
  }
  if (task?.tkrExempt === true) {
    return { exempt: true, reason: "task marked tkrExempt in queue" };
  }
  return { exempt: false, reason: null };
}

/**
 * @param {string} root
 * @param {string} taskId
 * @param {object} config
 */
export function verifyGitProofForTask(root, taskId, config = loadTkrConfig(root)) {
  if (!config.enabled) {
    return { ok: true, skipped: true, reason: "TKR disabled" };
  }

  const queue = readJson(root, config.queuePath);
  const task = queue?.tasks?.find((t) => t.id === taskId) ?? null;
  const exemptInfo = isTaskExempt(root, taskId, config, task);
  if (exemptInfo.exempt) {
    return {
      ok: true,
      exempt: true,
      reason: exemptInfo.reason,
      taskId,
    };
  }

  const proof = findGitProofForTask(root, taskId, config);
  if (!proof) {
    return {
      ok: false,
      exempt: false,
      taskId,
      reason: `No git commit references task '${taskId}'. Commit with e.g. "Fixes ${taskId}" then retry.`,
      needles: buildCommitNeedles(taskId, config),
    };
  }

  return {
    ok: true,
    exempt: false,
    taskId,
    proof,
  };
}

/** @param {string} root @param {object} config */
export function getWorktreeStatus(root, config) {
  if (!config.requireCleanWorktreeOnNext && !config.requireCleanWorktreeOnClose) {
    return { clean: true, skipped: true };
  }
  const porcelain = git(root, ["status", "--porcelain"]);
  if (!porcelain) {
    return { clean: true, lines: [] };
  }
  const lines = porcelain.split(/\r?\n/).filter(Boolean);
  return { clean: false, lines };
}

/** @param {string} root @param {object} config */
export function loadQueue(root, config) {
  const queue = readJson(root, config.queuePath);
  if (!queue?.tasks) {
    throw new Error(`Missing or invalid queue: ${config.queuePath}`);
  }
  return queue;
}

/** @param {object} queue */
export function queueById(queue) {
  /** @type {Record<string, object>} */
  const byId = {};
  for (const t of queue.tasks) byId[t.id] = t;
  return byId;
}

/**
 * Gate is satisfied for TKR when queue status is done AND git proof exists (or exempt).
 * @param {string} root
 * @param {string} gateId
 * @param {object} config
 */
export function verifyGateProof(root, gateId, config) {
  const queue = loadQueue(root, config);
  const byId = queueById(queue);
  const gate = byId[gateId];
  if (!gate) {
    return { ok: false, gateId, reason: `Unknown gate ${gateId}` };
  }
  if (gate.status !== "done") {
    return { ok: false, gateId, reason: `Gate ${gateId} status is ${gate.status}, not done` };
  }
  if (!config.requireGitProofForGates) {
    return { ok: true, gateId, skipped: true };
  }
  const proofResult = verifyGitProofForTask(root, gateId, config);
  if (!proofResult.ok) {
    return {
      ok: false,
      gateId,
      reason: proofResult.reason,
      proofResult,
    };
  }
  return { ok: true, gateId, exempt: proofResult.exempt, proof: proofResult.proof };
}

/**
 * @param {string} root
 * @param {string} taskId
 * @param {object} config
 */
export function verifyAllGatesForTask(root, taskId, config) {
  const queue = loadQueue(root, config);
  const task = queue.tasks.find((t) => t.id === taskId);
  if (!task) {
    return { ok: false, taskId, reason: `Task ${taskId} not in queue` };
  }
  const failures = [];
  for (const gateId of task.gates ?? []) {
    const r = verifyGateProof(root, gateId, config);
    if (!r.ok) failures.push(r);
  }
  if (failures.length > 0) {
    return { ok: false, taskId, failures };
  }
  return { ok: true, taskId, gates: task.gates ?? [] };
}

/**
 * Pre-flight before agent:next / agent:next-bug.
 * @param {string} root
 * @param {object} options
 */
export function checkReadyForNext(root, options = {}) {
  const config = options.config ?? loadTkrConfig(root);
  if (!config.enabled) {
    return { ok: true, skipped: true, reason: "TKR disabled" };
  }

  const failures = [];

  if (config.requireCleanWorktreeOnNext) {
    const wt = getWorktreeStatus(root, config);
    if (!wt.clean) {
      failures.push({
        code: "DIRTY_WORKTREE",
        reason:
          "Working tree has uncommitted changes. Commit with Fixes {taskId} before picking the next task.",
        lines: wt.lines?.slice(0, 20),
      });
    }
  }

  if (options.taskId && config.requireGitProofForGates) {
    const gateCheck = verifyAllGatesForTask(root, options.taskId, config);
    if (!gateCheck.ok) {
      failures.push({
        code: "GATE_NO_PROOF",
        taskId: options.taskId,
        failures: gateCheck.failures,
      });
    }
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }
  return { ok: true };
}

/**
 * Persist gitProofSha on closure (called after successful verify on close).
 * @param {string} root
 * @param {string} taskId
 * @param {string} sha
 * @param {object} config
 */
export function stampClosureGitProof(root, taskId, sha, config) {
  const historyPath = path.join(root, config.historyPath.replace(/\//g, path.sep));
  if (!fs.existsSync(historyPath)) return;
  const history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
  if (!history.closures?.[taskId]) return;
  history.closures[taskId].gitProofSha = sha;
  history.closures[taskId].gitProofAt = new Date().toISOString();
  fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}\n`, "utf8");
}
