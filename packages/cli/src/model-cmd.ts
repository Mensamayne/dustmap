/**
 * `dustmap model pull <id> [--from <url>]` / `dustmap model list` — the only Dustmap commands that
 * touch the network, and only when called (EMB-11). `pull` reads `<from>/<id>/manifest.json`, refuses
 * a package marked `private: true`, downloads every listed file into a temporary directory next to
 * the model directory while hashing it, and moves the package into place only when every SHA-256
 * and size matches — a failed or altered download leaves nothing behind. The model directory is the
 * user's (`semantic.modelDir`, `$DUSTMAP_MODELS_DIR` or `~/.cache/dustmap/models`), never the repo.
 * Embedding and pair-judge packages share the same layout; verification uses the matching loader.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defaultConfig, loadConfig, loadJudgePackage, loadModelPackage, resolveModelDir } from "@dustmap/core";
import type { ModelListArgs, ModelPullArgs } from "./args.js";

export type CmdResult = { exitCode: 0 | 1 | 2; stdout: string; stderr: string };

/**
 * Published packages on Hugging Face (REL-06). Override with `--from` for mirrors or tests.
 * Layout: `<source>/<id>/manifest.json` plus the files listed in the manifest.
 */
export const DEFAULT_MODEL_SOURCE = "https://huggingface.co/Mensamayne/dustmap-models/resolve/main";

/** Verify an installed folder as either an embedding package or a pair-judge package. */
function verifyInstalledPackage(dir: string, id: string): { version: string; licence: string | null; private: boolean; kind: "embedding" | "judge" } {
  try {
    const m = loadModelPackage(dir, id);
    return { version: m.version, licence: m.licence, private: m.private, kind: "embedding" };
  } catch (embErr) {
    try {
      const m = loadJudgePackage(dir, id);
      const raw = JSON.parse(readFileSync(path.join(dir, id, "manifest.json"), "utf8")) as { licence?: string | null };
      return { version: m.version, licence: raw.licence ?? null, private: m.private, kind: "judge" };
    } catch {
      throw embErr;
    }
  }
}

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer: () => Promise<ArrayBuffer> }>;

type RemoteManifest = {
  id: string;
  version: string;
  private: boolean;
  licence: string | null;
  files: Record<string, { sha256: string; bytes: number }>;
};

function modelDirFor(cwd: string, override?: string): string {
  if (override) return path.resolve(cwd, override);
  const config = existsSync(path.join(cwd, "dustmap.config.json")) ? loadConfig(cwd).config : defaultConfig();
  return resolveModelDir(config.semantic);
}

const fail = (message: string, exitCode: 1 | 2 = 1): CmdResult => ({ exitCode, stdout: "", stderr: `dustmap model: ${message}\n` });

/** Download one package; nothing is left on disk unless every file matched its manifest entry. */
export async function runModelPull(args: ModelPullArgs, cwd = process.cwd(), fetchImpl: FetchLike = fetch as FetchLike): Promise<CmdResult> {
  const source = args.from ?? DEFAULT_MODEL_SOURCE;
  if (!/^https?:\/\//i.test(source)) return fail(`--from must be an http(s) URL (got "${source}")`, 2);
  const base = `${source.replace(/\/+$/, "")}/${encodeURIComponent(args.id)}`;
  const dir = modelDirFor(cwd, args.modelDir);

  const get = async (file: string): Promise<Buffer> => {
    const res = await fetchImpl(`${base}/${file.split("/").map(encodeURIComponent).join("/")}`);
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };

  let manifestRaw: Buffer;
  let manifest: RemoteManifest;
  try {
    manifestRaw = await get("manifest.json");
    manifest = JSON.parse(manifestRaw.toString("utf8")) as RemoteManifest;
  } catch (err) {
    return fail(`cannot read ${base}/manifest.json — ${(err as Error).message}`);
  }
  if (manifest.id !== args.id) return fail(`manifest at ${base} is for "${manifest.id}", not "${args.id}"`);
  if (manifest.private !== false) {
    return fail(`"${args.id}" is a private model package (private: ${String(manifest.private)}); Dustmap never downloads or publishes private models`);
  }
  for (const name of Object.keys(manifest.files ?? {})) {
    if (name.includes("..") || path.isAbsolute(name) || name === "manifest.json") return fail(`manifest lists an unsafe file name "${name}"`);
  }

  mkdirSync(dir, { recursive: true });
  const partialRoot = path.join(dir, `.partial-${randomUUID().slice(0, 8)}`);
  const partial = path.join(partialRoot, args.id);
  mkdirSync(partial, { recursive: true });
  try {
    let bytes = 0;
    for (const [name, meta] of Object.entries(manifest.files)) {
      const data = await get(name);
      const sha = createHash("sha256").update(data).digest("hex");
      if (sha !== meta.sha256 || data.byteLength !== meta.bytes) {
        throw new Error(`${name} does not match its SHA-256 / size in manifest.json — download refused, nothing kept`);
      }
      const target = path.join(partial, name);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, data);
      bytes += data.byteLength;
    }
    writeFileSync(path.join(partial, "manifest.json"), manifestRaw);
    // Same check a scan does before loading (embedding or pair-judge package).
    const verified = verifyInstalledPackage(partialRoot, args.id);
    const final = path.join(dir, args.id);
    const old = existsSync(final) ? `${final}.old-${randomUUID().slice(0, 8)}` : null;
    if (old) renameSync(final, old);
    renameSync(partial, final);
    if (old) rmSync(old, { recursive: true, force: true });
    const summary = {
      id: manifest.id,
      version: verified.version,
      licence: verified.licence,
      kind: verified.kind,
      files: Object.keys(manifest.files).length,
      bytes,
      dir: final,
    };
    return {
      exitCode: 0,
      stdout: args.json
        ? `${JSON.stringify(summary, null, 2)}\n`
        : `Downloaded ${manifest.id} ${verified.version} (${verified.kind}, licence ${verified.licence}, ${(bytes / 1024 / 1024).toFixed(1)} MB) to ${final}. SHA-256 sums match; it runs offline from now on.\n`,
      stderr: "",
    };
  } catch (err) {
    return fail((err as Error).message);
  } finally {
    rmSync(partialRoot, { recursive: true, force: true });
  }
}

/** Installed packages, each checked against its manifest. */
export function runModelList(args: ModelListArgs, cwd = process.cwd()): CmdResult {
  const dir = modelDirFor(cwd, args.modelDir);
  const ids = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort() : [];
  const rows = ids.map((id) => {
    try {
      const verified = verifyInstalledPackage(dir, id);
      const raw = JSON.parse(readFileSync(path.join(dir, id, "manifest.json"), "utf8")) as {
        files?: Record<string, { bytes: number }>;
        variants?: Record<string, { calibration?: unknown }>;
      };
      const bytes = Object.values(raw.files ?? {}).reduce((s, f) => s + f.bytes, 0);
      const variants = Object.keys(raw.variants ?? {});
      const calibrated = Object.values(raw.variants ?? {}).some((v) => v.calibration);
      return {
        id,
        version: verified.version,
        private: verified.private,
        licence: verified.licence,
        kind: verified.kind,
        variants,
        calibrated,
        bytes,
        ok: true as const,
      };
    } catch (err) {
      return { id, ok: false as const, error: (err as Error).message };
    }
  });
  if (args.json) return { exitCode: 0, stdout: `${JSON.stringify({ dir, models: rows }, null, 2)}\n`, stderr: "" };
  const lines = rows.map((r) =>
    r.ok
      ? `  ${r.id} ${r.version} · ${r.kind} · ${r.private ? "private" : `licence ${r.licence}`} · variants ${r.variants.join(", ")}${r.calibrated ? " · calibrated" : ""} · ${(r.bytes / 1024 / 1024).toFixed(0)} MB`
      : `  ${r.id} — DAMAGED: ${r.error}`,
  );
  return { exitCode: 0, stdout: `Models in ${dir}:\n${lines.length ? lines.join("\n") : "  (none — dustmap model pull <id>)"}\n`, stderr: "" };
}
