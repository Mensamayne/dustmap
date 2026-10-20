#!/usr/bin/env node
/**
 * DUST-18 agent-eval — scripted MCP dogfood on the pinned monorepo-a snapshot.
 *
 *   npm run agent-eval              scripted tasks + oversize selftest (must exit 0)
 *   npm run agent-eval -- --live    also run Claude Code -p on each task prompt (optional)
 *
 * Never writes into ../monorepo-a, nor into the pinned snapshot output: decisions, queues and
 * transcripts stay under .tmp/agent-eval/.
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const evalDir = path.join(root, ".tmp", "agent-eval");
const tasksPath = path.join(root, "tools", "agent-eval", "tasks.json");

function utf8Bytes(s) {
  return Buffer.byteLength(s, "utf8");
}

function get(obj, dotted) {
  const parts = dotted.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

function loadTasks() {
  return JSON.parse(readFileSync(tasksPath, "utf8"));
}

function resolveSnapshot(spec) {
  const label = `${spec.target}@${spec.sha.slice(0, 12)}`;
  const base = path.join(root, ".tmp", "targets", label);
  const src = path.join(base, "src");
  const out = path.join(base, "out");
  const report = path.join(out, "report.json");
  if (!existsSync(report)) {
    fail(
      `Brak raportu dla migawki ${label}. Uruchom najpierw:\n` +
        `  npm run target -- ${spec.target} --snapshot ${spec.sha.slice(0, 12)}\n` +
        `(albo pełne SHA). Cel: ${base}`,
      2,
    );
  }
  return { label, base, src, out, report };
}

async function connectMcp(cwd, maxResponseBytes) {
  // tsx resolves .ts workspace sources when this file is launched via `tsx`.
  const { createDustmapMcpServer } = await import("../../packages/mcp/src/server.ts");
  const server = createDustmapMcpServer({ cwd, maxResponseBytes });
  const client = new Client({ name: "dustmap-agent-eval", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function textPayload(result) {
  const part = result.content?.find((c) => c.type === "text");
  if (!part?.text) throw new Error("tool result missing text content");
  return part.text;
}

/** Snapshots from `git archive` + `git init` often have no HEAD — empty commit is enough. */
function ensureSnapshotHead(src) {
  try {
    execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: src,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    execFileSync(
      "git",
      ["-c", "user.email=agent-eval@dustmap.test", "-c", "user.name=agent-eval", "commit", "--allow-empty", "-m", "agent-eval HEAD"],
      { cwd: src, stdio: ["ignore", "pipe", "pipe"] },
    );
  }
}

function prepareEvalOut(snapshotOut) {
  const evalOut = path.join(evalDir, "out");
  rmSync(evalOut, { recursive: true, force: true });
  mkdirSync(evalOut, { recursive: true });
  copyFileSync(path.join(snapshotOut, "report.json"), path.join(evalOut, "report.json"));
  return evalOut;
}

function prepareStaleOut(liveOut, staleOut) {
  rmSync(staleOut, { recursive: true, force: true });
  mkdirSync(staleOut, { recursive: true });
  const report = JSON.parse(readFileSync(path.join(liveOut, "report.json"), "utf8"));
  report.scan = {
    ...report.scan,
    commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  };
  // Keep payload small for stale check — summary only needs scan + summary + few findings.
  report.findings = (report.findings ?? []).slice(0, 5);
  writeFileSync(path.join(staleOut, "report.json"), JSON.stringify(report));
}

function ensureEnqueueWorkspace(queueDir, briefsDir, outDir) {
  rmSync(queueDir, { recursive: true, force: true });
  rmSync(briefsDir, { recursive: true, force: true });
  mkdirSync(queueDir, { recursive: true });
  mkdirSync(briefsDir, { recursive: true });
  const work = path.join(evalDir, "enqueue-cwd");
  mkdirSync(work, { recursive: true });
  writeFileSync(
    path.join(queueDir, "queue.json"),
    JSON.stringify({ version: 1, notes: "agent-eval dogfood queue", tasks: [] }, null, 2),
  );
  writeFileSync(
    path.join(work, "dustmap.config.json"),
    JSON.stringify(
      {
        outputDir: outDir,
        sinks: {
          briefs: {
            queuePath: path.join(queueDir, "queue.json"),
            briefsDir,
            idPrefix: "DOG",
            defaults: { segment: "dogfood", kind: "feature", layer: 200, epic: "DOG" },
          },
        },
      },
      null,
      2,
    ),
  );
  return work;
}

function runEnqueue(enqueueCwd, outDir, fingerprints) {
  const bin = path.join(root, "packages/sink-briefs/bin/dustmap-briefs.mjs");
  const args = [bin, "enqueue", ...fingerprints, "--out", outDir];
  const r = spawnSync(process.execPath, args, {
    cwd: enqueueCwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

function interpolate(value, ctx) {
  if (typeof value === "string") {
    return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (ctx[key] === undefined || ctx[key] === null) {
        throw new Error(`Missing template {{${key}}}`);
      }
      return String(ctx[key]);
    });
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, ctx));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = interpolate(v, ctx);
    return out;
  }
  return value;
}

function checkExpect(expect, calls, ctx) {
  const errors = [];
  for (const call of calls) {
    if (call.bytes > (expect.maxBytes ?? ctx.maxResponseBytes)) {
      errors.push(`${call.tool}: response ${call.bytes} bytes > max ${expect.maxBytes}`);
    }
    if (expect.everyResponseHasNext) {
      if (!Array.isArray(call.data?.next) || call.data.next.length < 1) {
        errors.push(`${call.tool}: missing next[]`);
      } else if (call.data.next.length > 3) {
        errors.push(`${call.tool}: next[] longer than 3`);
      }
    }
    if (expect.guideMaxBytes != null && call.tool === "dustmap_guide") {
      const g = call.data?.guide;
      if (typeof g === "string" && utf8Bytes(g) > expect.guideMaxBytes) {
        errors.push(`guide body ${utf8Bytes(g)} > ${expect.guideMaxBytes}`);
      }
    }
  }

  const last = calls[calls.length - 1]?.data ?? {};
  for (const p of expect.paths ?? []) {
    const v = get(last, p.path);
    if (p.equals !== undefined && v !== p.equals) {
      errors.push(`last.${p.path}: expected ${JSON.stringify(p.equals)}, got ${JSON.stringify(v)}`);
    }
    if (p.type === "boolean" && typeof v !== "boolean") {
      errors.push(`last.${p.path}: expected boolean`);
    }
    if (p.minLength != null) {
      const len = typeof v === "string" ? v.length : Array.isArray(v) ? v.length : -1;
      if (len < p.minLength) errors.push(`last.${p.path}: length ${len} < ${p.minLength}`);
    }
  }

  if (expect.toolsUsed) {
    const used = new Set(calls.map((c) => c.tool));
    for (const t of expect.toolsUsed) {
      if (!used.has(t)) errors.push(`required tool not used: ${t}`);
    }
  }

  if (expect.minHighConfidenceDeadCode != null) {
    const items = last.items ?? [];
    const high = items.filter((i) => i.category === "dead-code" && i.confidence === "high");
    if (high.length < expect.minHighConfidenceDeadCode) {
      errors.push(
        `expected ≥${expect.minHighConfidenceDeadCode} high-confidence dead-code in page, got ${high.length}`,
      );
    }
  }

  if (expect.decisionOnlyUnderOut) {
    const decisions = path.join(ctx.out, "decisions.yml");
    if (!existsSync(decisions)) errors.push("decisions.yml missing under outputDir");
    // Snapshot src must not gain a decisions.yml at repo root.
    const leak = path.join(ctx.src, "decisions.yml");
    if (existsSync(leak)) errors.push("decisions.yml leaked into snapshot src");
  }

  if (expect.enqueueCount != null) {
    const q = JSON.parse(readFileSync(path.join(ctx.queueDir, "queue.json"), "utf8"));
    const dog = (q.tasks ?? []).filter((t) => String(t.source ?? "").startsWith("dustmap:"));
    if (dog.length < expect.enqueueCount) {
      errors.push(`enqueueCount: expected ≥${expect.enqueueCount}, got ${dog.length}`);
    }
  }

  if (calls.length > (ctx.maxCalls ?? 99)) {
    errors.push(`too many calls: ${calls.length} > ${ctx.maxCalls}`);
  }

  return errors;
}

async function runTask(task, env, pair) {
  const ctx = {
    out: env.out,
    staleOut: env.staleOut,
    src: env.src,
    queueDir: env.queueDir,
    maxResponseBytes: env.maxResponseBytes,
    maxCalls: task.maxCalls ?? 10,
    topFingerprint: env.topFingerprint,
    listFingerprint: null,
    listFingerprint2: null,
  };

  const calls = [];
  for (const step of task.script ?? []) {
    const args = interpolate(step.args ?? {}, ctx);
    const raw = await pair.client.callTool({ name: step.tool, arguments: args });
    const text = textPayload(raw);
    const data = JSON.parse(text);
    calls.push({
      tool: step.tool,
      args,
      bytes: utf8Bytes(text),
      data,
      isError: Boolean(raw.isError),
    });

    if (step.tool === "dustmap_summary" && Array.isArray(data.topPlaces?.[0]?.findingFingerprints)) {
      ctx.topFingerprint = data.topPlaces[0].findingFingerprints[0] ?? ctx.topFingerprint;
    }
    if (step.tool === "dustmap_list" && Array.isArray(data.items)) {
      ctx.listFingerprint = data.items[0]?.fingerprint ?? ctx.listFingerprint;
      ctx.listFingerprint2 = data.items[1]?.fingerprint ?? ctx.listFingerprint2;
    }
  }

  let enqueueResult = null;
  if (task.post?.enqueueFingerprints) {
    const fps = interpolate(task.post.enqueueFingerprints, ctx);
    const unique = [...new Set(fps.filter((f) => typeof f === "string" && /^[a-f0-9]{16}$/.test(f)))];
    if (unique.length < (task.expect?.enqueueCount ?? 1)) {
      return {
        id: task.id,
        ok: false,
        errors: [
          `not enough distinct fingerprints to enqueue: ${JSON.stringify(fps)} → ${JSON.stringify(unique)}`,
        ],
        calls,
        enqueueResult: null,
      };
    }
    enqueueResult = runEnqueue(env.enqueueCwd, env.out, unique);
    if (enqueueResult.status !== 0) {
      return {
        id: task.id,
        ok: false,
        errors: [`enqueue failed: ${enqueueResult.stderr || enqueueResult.stdout}`],
        calls,
        enqueueResult,
      };
    }
  }

  const errors = checkExpect(task.expect ?? {}, calls, ctx);
  return { id: task.id, prompt: task.prompt, ok: errors.length === 0, errors, calls, enqueueResult };
}

/**
 * Negative selftest: a planted oversize payload must be rejected by checkExpect.
 */
function runOversizeSelftest(maxBytes) {
  const planted = {
    tool: "dustmap_list",
    bytes: maxBytes + 1000,
    data: { next: [{ tool: "dustmap_show", reason: "x" }], items: [] },
  };
  const errors = checkExpect(
    { maxBytes, everyResponseHasNext: true },
    [planted],
    { maxResponseBytes: maxBytes, out: evalDir, src: evalDir, queueDir: evalDir, maxCalls: 5 },
  );
  const caught = errors.some((e) => /bytes > max/.test(e));
  if (!caught) {
    fail(`isolation.selftest-style: oversize was NOT detected (errors=${JSON.stringify(errors)})`);
  }
  console.log("PASS: oversize response turns agent-eval expectations red");
}

/** Outputs a task works on: the stale copy when its script reads `{{staleOut}}`, else the eval copy. */
function taskOutDir(task, env) {
  return JSON.stringify(task.script ?? []).includes("{{staleOut}}") ? env.staleOut : env.out;
}

/**
 * Read a `claude -p --output-format stream-json` transcript: Dustmap MCP tool calls in order,
 * plus the final result record (error flag, cost, answer text).
 */
export function parseLiveTranscript(stdout) {
  const toolCalls = [];
  let result = null;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === "assistant" && Array.isArray(event.message?.content)) {
      for (const block of event.message.content) {
        if (block.type === "tool_use") toolCalls.push(String(block.name));
      }
    }
    if (event.type === "result") result = event;
  }
  return { toolCalls, result };
}

/** Success = clean exit, required Dustmap tools used, call budget kept. Returns reasons when not. */
export function judgeLiveRun(task, exitCode, parsed) {
  const errors = [];
  if (exitCode !== 0) errors.push(`claude exit ${exitCode}`);
  if (!parsed.result) errors.push("no result record in transcript");
  else if (parsed.result.is_error) {
    errors.push(`agent error: ${String(parsed.result.result ?? parsed.result.subtype ?? "unknown").slice(0, 200)}`);
  }
  const used = new Set(parsed.toolCalls);
  for (const t of task.expect?.toolsUsed ?? []) {
    if (!used.has(`mcp__dustmap__${t}`)) errors.push(`required tool not used: ${t}`);
  }
  const max = task.maxCalls ?? 10;
  if (parsed.toolCalls.length > max) errors.push(`too many tool calls: ${parsed.toolCalls.length} > ${max}`);
  return errors;
}

/** Fail fast with a fix instead of eight identical "Not logged in" transcripts. */
function assertClaudeAuth() {
  if (process.env.ANTHROPIC_API_KEY) return;
  const r = spawnSync("claude", ["auth", "status"], { encoding: "utf8", windowsHide: true });
  if (r.error) throw new Error(`claude CLI not found on PATH (${r.error.message})`);
  let status;
  try {
    status = JSON.parse(r.stdout ?? "");
  } catch {
    throw new Error(`claude auth status returned no JSON (exit ${r.status}): ${(r.stdout ?? "").slice(0, 200)}`);
  }
  if (!status.loggedIn) {
    throw new Error(
      "claude CLI is not logged in (claude auth status → loggedIn: false). " +
        "Run `claude auth login` or set ANTHROPIC_API_KEY, then npm run agent-eval:live.",
    );
  }
}

async function runLiveAgent(tasks, env) {
  assertClaudeAuth();
  const mcpConfig = {
    mcpServers: {
      dustmap: {
        command: "node",
        args: [path.join(root, "packages/mcp/bin/dustmap-mcp.mjs")],
        env: {
          DUSTMAP_CWD: env.src,
        },
      },
    },
  };
  const mcpConfigPath = path.join(evalDir, "mcp-live.json");
  writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
  // `--bare` reads only ANTHROPIC_API_KEY (never the OAuth login), so it is used only when a key is set.
  const bare = process.env.ANTHROPIC_API_KEY ? ["--bare"] : [];

  const liveResults = [];
  for (const task of tasks) {
    const transcriptPath = path.join(evalDir, "live", `${task.id}.jsonl`);
    mkdirSync(path.dirname(transcriptPath), { recursive: true });
    const out = taskOutDir(task, env);
    const prompt =
      `${task.prompt}\n\n` +
      `Working directory is a Dustmap snapshot. Report outputDir is:\n${out}\n` +
      `Use Dustmap MCP tools only. Prefer dustmap_guide then follow next[]. ` +
      `Do not modify files outside ${out} except via dustmap_decide / documented sinks. ` +
      `Stop after you answered. Max ${task.maxCalls} tool calls.`;

    const r = spawnSync(
      "claude",
      [
        "-p",
        prompt,
        ...bare,
        "--mcp-config",
        mcpConfigPath,
        "--strict-mcp-config",
        "--allowedTools",
        "mcp__dustmap__*",
        "--max-budget-usd",
        "0.5",
        "--output-format",
        "stream-json",
        "--verbose",
      ],
      {
        cwd: env.src,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
        timeout: 300_000,
        env: { ...process.env, DUSTMAP_CWD: env.src },
      },
    );
    writeFileSync(transcriptPath, `${r.stdout ?? ""}\n${r.stderr ? `STDERR:\n${r.stderr}\n` : ""}`);
    const parsed = parseLiveTranscript(r.stdout ?? "");
    const errors = judgeLiveRun(task, r.status, parsed);
    liveResults.push({
      id: task.id,
      ok: errors.length === 0,
      exit: r.status,
      errors,
      toolCalls: parsed.toolCalls,
      costUsd: parsed.result?.total_cost_usd ?? null,
      answer: typeof parsed.result?.result === "string" ? parsed.result.result : null,
      transcriptPath: path.relative(root, transcriptPath).replace(/\\/g, "/"),
    });
  }
  return liveResults;
}

async function main() {
  const live = process.argv.includes("--live");
  const spec = loadTasks();
  mkdirSync(evalDir, { recursive: true });

  runOversizeSelftest(spec.maxResponseBytes ?? 32768);

  const snap = resolveSnapshot(spec.snapshot);
  ensureSnapshotHead(snap.src);
  // Decisions and enqueues land in a throwaway copy: the pinned snapshot output stays a clean measurement.
  const evalOut = prepareEvalOut(snap.out);
  const staleOut = path.join(evalDir, "stale-out");
  prepareStaleOut(snap.out, staleOut);

  const queueDir = path.join(evalDir, "queue");
  const briefsDir = path.join(evalDir, "briefs");
  const enqueueCwd = ensureEnqueueWorkspace(queueDir, briefsDir, evalOut);

  const report = JSON.parse(readFileSync(snap.report, "utf8"));
  const topFingerprint = report.summary?.topPlaces?.[0]?.findingFingerprints?.[0] ?? null;

  const pair = await connectMcp(snap.src, spec.maxResponseBytes ?? 32768);
  const env = {
    src: snap.src,
    out: evalOut,
    staleOut,
    queueDir,
    enqueueCwd,
    maxResponseBytes: spec.maxResponseBytes ?? 32768,
    topFingerprint,
  };

  const scripted = [];
  try {
    for (const task of spec.tasks) {
      process.stdout.write(`… ${task.id} `);
      const result = await runTask(task, env, pair);
      scripted.push(result);
      console.log(result.ok ? "OK" : `FAIL (${result.errors.join("; ")})`);
    }
  } finally {
    await pair.close();
  }

  let liveResults = null;
  if (live) {
    console.log("\n— live Claude Code (-p) —");
    try {
      liveResults = await runLiveAgent(spec.tasks, env);
      for (const r of liveResults) {
        console.log(
          `${r.id}: ${r.ok ? "OK" : `FAIL (${r.errors.join("; ")})`} · ${r.toolCalls.length} calls → ${r.transcriptPath}`,
        );
      }
    } catch (err) {
      liveResults = [
        {
          id: "_live",
          ok: false,
          note: `live agent harness error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ];
      console.error(liveResults[0].note);
    }
  }

  const summary = {
    at: new Date().toISOString(),
    snapshot: snap.label,
    scripted,
    live: liveResults,
    scriptedPassed: scripted.filter((t) => t.ok).length,
    scriptedTotal: scripted.length,
  };
  writeFileSync(path.join(evalDir, "results.json"), JSON.stringify(summary, null, 2));

  const failed = scripted.filter((t) => !t.ok);
  if (failed.length) {
    console.error(`\nagent-eval: ${failed.length}/${scripted.length} scripted tasks failed`);
    process.exit(1);
  }
  const liveFailed = (liveResults ?? []).filter((t) => !t.ok);
  if (live && liveFailed.length) {
    console.error(`\nagent-eval: live agent failed ${liveFailed.length} task(s) — see .tmp/agent-eval/results.json`);
    process.exit(1);
  }
  console.log(
    `\nagent-eval: OK (${scripted.length} scripted tasks, oversize selftest${live ? `, ${liveResults.length} live tasks` : ""})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
