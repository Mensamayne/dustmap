/**
 * Local semantic pairs via jscpd `--semantic` (built-in jina / configured model). Writes only under
 * a temp directory — never into the scanned repo.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { copyFileSync, linkSync, mkdirSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { toPosix } from "../posix.js";
import type { SemanticFunctionRef, SemanticPair } from "./cluster.js";

const require = createRequire(import.meta.url);

function jscpdBin(): string {
  const root = path.dirname(require.resolve("jscpd/package.json"));
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
    bin?: string | Record<string, string>;
  };
  const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.jscpd;
  if (!rel) throw new Error("jscpd package.json missing bin.jscpd");
  return path.join(root, rel);
}

function materialize(repoRoot: string, files: readonly string[], destRoot: string): void {
  for (const rel of files) {
    const src = path.join(repoRoot, rel);
    const dest = path.join(destRoot, ...rel.split("/"));
    mkdirSync(path.dirname(dest), { recursive: true });
    try {
      linkSync(src, dest);
    } catch {
      copyFileSync(src, dest);
    }
  }
}

function runProcess(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0" },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (c: string) => {
      stdout += c;
    });
    child.stderr.on("data", (c: string) => {
      stderr += c;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

type JscpdDup = {
  kind?: string;
  similarity?: number;
  fragment?: string;
  firstFile: {
    name: string;
    startLoc?: { line: number };
    endLoc?: { line: number };
    start: number;
    end: number;
  };
  secondFile: {
    name: string;
    startLoc?: { line: number };
    endLoc?: { line: number };
    start: number;
    end: number;
  };
};

function resolveName(name: string, scanRootPosix: string): string {
  let n = toPosix(name);
  const root = scanRootPosix.replace(/\/$/, "");
  if (root && (n === root || n.startsWith(`${root}/`))) {
    n = n.slice(root.length + (n === root ? 0 : 1));
  }
  return n.replace(/^\.\//, "");
}

function guessName(fragment: string | undefined, fallback: string): string {
  if (!fragment) return fallback;
  const m = /function\s+(\w+)|(?:const|let)\s+(\w+)\s*=/.exec(fragment);
  return m?.[1] ?? m?.[2] ?? fallback;
}

export type JscpdSemanticReport = { duplicates?: JscpdDup[] };

/**
 * Turn jscpd's semantic report into function pairs. jscpd's `fragment` is the first file's text only,
 * so each side's name and body are read from its own file under `scanRoot` (BUG-07).
 */
export function pairsFromJscpdReport(report: JscpdSemanticReport, scanRoot: string): SemanticPair[] {
  const scanPosix = toPosix(scanRoot);
  const lines = new Map<string, string[]>();
  const side = (f: JscpdDup["firstFile"]): SemanticFunctionRef => {
    const rel = resolveName(f.name, scanPosix);
    const start = f.startLoc?.line ?? f.start;
    const end = f.endLoc?.line ?? f.end;
    let fileLines = lines.get(rel);
    if (!fileLines) {
      fileLines = readFileSync(path.join(scanRoot, ...rel.split("/")), "utf8").split(/\r?\n/);
      lines.set(rel, fileLines);
    }
    const body = fileLines.slice(Math.max(0, start - 1), end).join("\n");
    return { path: rel, name: guessName(body, path.basename(rel)), startLine: start, endLine: end, body };
  };
  const pairs: SemanticPair[] = [];
  for (const d of report.duplicates ?? []) {
    if (d.kind && d.kind !== "semantic") continue;
    pairs.push({ a: side(d.firstFile), b: side(d.secondFile), similarity: d.similarity ?? 0 });
  }
  return pairs;
}

export type JscpdSemanticOptions = {
  model: string;
  /** Similarity floor passed to jscpd (slightly below report threshold so we can filter). */
  sameThreshold: number;
  minTokens: number;
  minLines: number;
};

/** Run jscpd semantic on a hardlink tree of `files`; return pairs with similarity scores. */
export async function runJscpdSemanticPairs(
  repoRoot: string,
  files: readonly string[],
  opts: JscpdSemanticOptions,
): Promise<SemanticPair[]> {
  if (files.length < 2) return [];
  const work = await mkdtemp(path.join(tmpdir(), "dustmap-sem-"));
  const scanRoot = path.join(work, "src");
  const outputDir = path.join(work, "out");
  mkdirSync(scanRoot, { recursive: true });
  mkdirSync(outputDir, { recursive: true });
  try {
    materialize(repoRoot, files, scanRoot);
    const args = [
      jscpdBin(),
      "--semantic",
      "--semantic-scope",
      "same",
      "--semantic-model",
      opts.model,
      "--semantic-same-threshold",
      String(opts.sameThreshold),
      "--kind",
      "semantic",
      "--min-tokens",
      String(opts.minTokens),
      "--min-lines",
      String(opts.minLines),
      "--reporters",
      "json",
      "--output",
      outputDir,
      "--silent",
      "--format",
      "typescript,javascript,tsx,jsx",
      ".",
    ];
    const { code, stderr, stdout } = await runProcess(process.execPath, args, scanRoot);
    if (code !== 0 && code !== 1) {
      throw new Error(`jscpd --semantic exited ${code}: ${stderr.trim() || stdout.trim()}`);
    }
    let raw: string;
    try {
      raw = await readFile(path.join(outputDir, "jscpd-report.json"), "utf8");
    } catch {
      return [];
    }
    return pairsFromJscpdReport(JSON.parse(raw) as JscpdSemanticReport, scanRoot);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
