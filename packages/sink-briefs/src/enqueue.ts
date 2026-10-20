/**
 * Enqueue selected finding fingerprints into a file queue + markdown briefs.
 * Same fingerprint twice → no second brief or queue row. Never overwrites briefs.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FindingType, ReportType } from "@dustmap/contract";
import {
  type BriefsSinkConfigType,
  defaultConfig,
  loadConfig,
  loadReportFile,
  resolveOutputDir,
  type ReportKind,
} from "@dustmap/core";
import {
  briefFileName,
  findBySource,
  loadQueueFile,
  nextId,
  saveQueueFile,
  sourceKey,
  type QueueTask,
} from "./queue-io.js";
import { renderBrief, titleForFinding } from "./template.js";

export type EnqueueOptions = {
  cwd: string;
  fingerprints: string[];
  /** Override outputDir that holds the reports. */
  out?: string;
  /** full = report.json (default); diff = report.diff.json from a diff scan (BUG-03). */
  report?: ReportKind;
  configPath?: string;
};

export type EnqueueItemResult =
  | { fingerprint: string; status: "created"; id: string; brief: string }
  | { fingerprint: string; status: "exists"; id: string; brief: string }
  | { fingerprint: string; status: "error"; error: string };

export type EnqueueResult = {
  exitCode: 0 | 2;
  items: EnqueueItemResult[];
  stdout: string;
  stderr: string;
};

function requireBriefsConfig(cwd: string, configPath?: string): BriefsSinkConfigType {
  const loaded = loadConfig(cwd, configPath);
  const briefs = loaded.config.sinks.briefs;
  if (!briefs) {
    throw new Error(
      `dustmap.config.json has no sinks.briefs — see docs/INTEGRATION-QUEUE.md`,
    );
  }
  return briefs;
}

function resolveRepoPath(cwd: string, rel: string): string {
  return path.isAbsolute(rel) ? path.normalize(rel) : path.resolve(cwd, rel);
}

export function enqueueFingerprints(opts: EnqueueOptions): EnqueueResult {
  const items: EnqueueItemResult[] = [];
  let briefs: BriefsSinkConfigType;
  try {
    briefs = requireBriefsConfig(opts.cwd, opts.configPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { exitCode: 2, items: [], stdout: "", stderr: `${msg}\n` };
  }

  const config = existsSync(path.join(opts.cwd, "dustmap.config.json"))
    ? loadConfig(opts.cwd, opts.configPath).config
    : defaultConfig();
  const outDir = opts.out
    ? path.resolve(opts.cwd, opts.out)
    : resolveOutputDir(opts.cwd, config.outputDir);

  let report: ReportType;
  try {
    report = loadReportFile(outDir, opts.report ?? "full");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { exitCode: 2, items: [], stdout: "", stderr: `${msg}\n` };
  }

  if (opts.fingerprints.length === 0) {
    return {
      exitCode: 2,
      items: [],
      stdout: "",
      stderr: "Usage: dustmap-briefs enqueue <fingerprint…>\n",
    };
  }

  const queuePath = resolveRepoPath(opts.cwd, briefs.queuePath);
  const briefsDir = resolveRepoPath(opts.cwd, briefs.briefsDir);
  const templatePath = briefs.template
    ? resolveRepoPath(opts.cwd, briefs.template)
    : undefined;

  const queue = loadQueueFile(queuePath);
  mkdirSync(briefsDir, { recursive: true });

  const byFp = new Map(report.findings.map((f) => [f.fingerprint, f]));

  for (const fp of opts.fingerprints) {
    const existing = findBySource(queue, fp);
    if (existing) {
      items.push({
        fingerprint: fp,
        status: "exists",
        id: existing.id,
        brief: existing.brief,
      });
      continue;
    }

    const finding: FindingType | undefined = byFp.get(fp);
    if (!finding) {
      items.push({
        fingerprint: fp,
        status: "error",
        error: `No finding with fingerprint ${fp} in ${outDir}`,
      });
      continue;
    }

    const id = nextId(queue, briefs.idPrefix);
    const title = titleForFinding(finding);
    const fileName = briefFileName(id, title);
    const briefRel = path
      .join(path.relative(opts.cwd, briefsDir), fileName)
      .replace(/\\/g, "/");
    const briefAbs = path.join(briefsDir, fileName);

    if (existsSync(briefAbs)) {
      items.push({
        fingerprint: fp,
        status: "error",
        error: `Brief already exists (refusing overwrite): ${briefRel}`,
      });
      continue;
    }

    const epic = briefs.defaults.epic ?? briefs.idPrefix;
    const body = renderBrief({
      id,
      title,
      epic,
      segment: briefs.defaults.segment,
      layer: briefs.defaults.layer,
      finding,
      ...(templatePath ? { templatePath } : {}),
    });

    writeFileSync(briefAbs, body.endsWith("\n") ? body : `${body}\n`, "utf8");

    const task: QueueTask = {
      id,
      title,
      layer: briefs.defaults.layer,
      segment: briefs.defaults.segment,
      brief: briefRel,
      gates: [],
      status: "todo",
      kind: briefs.defaults.kind,
      source: sourceKey(fp),
      epic,
    };
    if (briefs.defaults.kind === "bug" && briefs.defaults.severity) {
      task.severity = briefs.defaults.severity;
    }

    queue.tasks.push(task);
    items.push({ fingerprint: fp, status: "created", id, brief: briefRel });
  }

  const created = items.some((i) => i.status === "created");
  if (created) {
    saveQueueFile(queuePath, queue);
  }

  const errors = items.filter((i) => i.status === "error");
  const lines = items.map((i) => {
    if (i.status === "created") return `created ${i.id} ← ${i.fingerprint} (${i.brief})`;
    if (i.status === "exists") return `exists  ${i.id} ← ${i.fingerprint} (skipped)`;
    return `error   ${i.fingerprint}: ${i.error}`;
  });

  return {
    exitCode: errors.length > 0 && !created ? 2 : 0,
    items,
    stdout: `${lines.join("\n")}\n`,
    stderr: errors.length && !created ? "enqueue failed\n" : "",
  };
}
