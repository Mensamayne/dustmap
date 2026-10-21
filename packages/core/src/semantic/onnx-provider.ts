/**
 * `onnx` semantic provider: runs a Dustmap model package (dustmap-emb package.py format) in-process
 * with ONNX Runtime — no network, no Python. The package directory is `<modelDir>/<id>/`; its
 * manifest.json lists every file with SHA-256, checked before anything is loaded (a missing or
 * altered package is a clear error, never a silent download — fetching is EMB-11). Device choice:
 * the `gpu` variant (fp16) on DirectML (Windows) or CUDA (Linux) when that works here, else the
 * `cpu` variant (int8 weights). Vectors of the two variants differ slightly, so the provider's
 * model id names the variant and the vector cache never mixes them.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";
import type { SemanticConfig } from "../config/schema.js";
import type { Calibration } from "./calibration.js";
import type { EmbeddingProvider } from "./provider.js";
import { loadOrt } from "./similarity.js";

const Bands = z.object({ high: z.number().nullable(), medium: z.number().nullable(), low: z.number().nullable() });
const Variant = z.object({
  file: z.string().min(1),
  sessionConfig: z.record(z.string()).optional(),
  /** Similarity bands from tools/emb/calibrate.mts (EMB-09); absent on uncalibrated packages. */
  calibration: z.object({ bands: Bands }).passthrough().optional(),
});

const Manifest = z.object({
  schema: z.literal("dustmap-embedding-model/1"),
  id: z.string().min(1),
  version: z.string().min(1),
  private: z.boolean(),
  licence: z.string().nullable(),
  input: z.object({
    tokenizer: z.string().min(1),
    names: z.tuple([z.literal("input_ids"), z.literal("attention_mask")]),
    maxTokens: z.number().int().min(8),
  }),
  output: z.object({ name: z.string().min(1), dimensions: z.number().int().positive(), normalized: z.literal(true) }),
  variants: z
    .object({
      cpu: Variant,
      gpu: Variant.optional(),
    })
    .passthrough(),
  files: z.record(z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/), bytes: z.number().int().nonnegative() })),
});
export type ModelManifest = z.infer<typeof Manifest>;

export class OnnxModelError extends Error {
  readonly code: "onnx_model_missing" | "onnx_model_corrupt" | "onnx_runtime_missing" | "onnx_gpu_unavailable";
  constructor(code: OnnxModelError["code"], message: string) {
    super(message);
    this.name = "OnnxModelError";
    this.code = code;
  }
}

/** `semantic.modelDir`, else `$DUSTMAP_MODELS_DIR`, else `~/.cache/dustmap/models`. */
export function resolveModelDir(cfg: Pick<SemanticConfig, "modelDir">): string {
  return path.resolve(cfg.modelDir ?? process.env.DUSTMAP_MODELS_DIR ?? path.join(homedir(), ".cache", "dustmap", "models"));
}

function sha256File(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** Read and check a package: manifest shape, every listed file present with its size and SHA-256. */
export function loadModelPackage(dir: string, id: string): ModelManifest {
  const pkg = path.join(dir, id);
  const manifestPath = path.join(pkg, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new OnnxModelError(
      "onnx_model_missing",
      `Semantic model "${id}" is not installed (no ${manifestPath}). Place the package there or set semantic.modelDir; Dustmap never downloads models on its own.`,
    );
  }
  let manifest: ModelManifest;
  try {
    manifest = Manifest.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
  } catch (err) {
    throw new OnnxModelError("onnx_model_corrupt", `Semantic model "${id}": manifest.json is not a valid model manifest (${(err as Error).message.slice(0, 300)}).`);
  }
  if (manifest.id !== id) {
    throw new OnnxModelError("onnx_model_corrupt", `Semantic model "${id}": manifest says id "${manifest.id}".`);
  }
  const needed = [manifest.input.tokenizer, manifest.variants.cpu.file, ...(manifest.variants.gpu ? [manifest.variants.gpu.file] : [])];
  for (const f of needed) {
    if (!manifest.files[f]) throw new OnnxModelError("onnx_model_corrupt", `Semantic model "${id}": ${f} is not listed in manifest.files.`);
  }
  for (const [name, meta] of Object.entries(manifest.files)) {
    const file = path.join(pkg, name);
    if (!existsSync(file)) throw new OnnxModelError("onnx_model_corrupt", `Semantic model "${id}": ${name} is missing.`);
    if (sha256File(file) !== meta.sha256) {
      throw new OnnxModelError("onnx_model_corrupt", `Semantic model "${id}": ${name} does not match its SHA-256 in manifest.json — reinstall the package.`);
    }
  }
  return manifest;
}

type Ort = typeof import("onnxruntime-node");
type Session = Awaited<ReturnType<Ort["InferenceSession"]["create"]>>;

async function importRuntime(): Promise<{ ort: Ort; Tokenizer: (typeof import("@huggingface/tokenizers"))["Tokenizer"] }> {
  try {
    const ort = await loadOrt();
    const { Tokenizer } = await import("@huggingface/tokenizers");
    return { ort, Tokenizer };
  } catch (err) {
    throw new OnnxModelError("onnx_runtime_missing", `semantic.provider "onnx" needs onnxruntime-node and @huggingface/tokenizers (${(err as Error).message.slice(0, 200)}).`);
  }
}

/** GPU execution providers ONNX Runtime ships for this platform, best first. */
function gpuProviders(): string[] {
  if (process.platform === "win32") return ["dml"];
  if (process.platform === "linux") return ["cuda"];
  return [];
}

export type OnnxProvider = EmbeddingProvider & {
  readonly variant: "cpu" | "gpu";
  /** Why the GPU variant is not in use (auto mode), or null. */
  readonly gpuFallbackReason: string | null;
  readonly manifest: ModelManifest;
  /** Calibration of the variant in use, or null when the package has none. */
  readonly calibration: Calibration | null;
  /** Tokens cut by truncation across all calls (inputs longer than input.maxTokens). */
  readonly truncated: { count: number };
  release: () => Promise<void>;
};

export type OpenOnnxOptions = {
  /** Package directory override (tests); default resolveModelDir(cfg). */
  modelDir?: string;
  /** Functions per run; batches are length-sorted, padding does not change vectors. */
  batch?: number;
  threads?: number;
};

/** Load, verify and start a model package. */
export async function openOnnxProvider(
  cfg: Pick<SemanticConfig, "model" | "modelDir" | "device">,
  opts: OpenOnnxOptions = {},
): Promise<OnnxProvider> {
  const dir = opts.modelDir ?? resolveModelDir(cfg);
  const manifest = loadModelPackage(dir, cfg.model);
  const pkg = path.join(dir, cfg.model);
  const { ort, Tokenizer } = await importRuntime();

  const create = (file: string, providers: string[], sessionConfig: Record<string, string> | undefined) =>
    ort.InferenceSession.create(path.join(pkg, file), {
      executionProviders: providers,
      graphOptimizationLevel: "all",
      logSeverityLevel: 3,
      ...(opts.threads ? { intraOpNumThreads: opts.threads } : {}),
      // Session config entries (e.g. session.disable_quant_qdq) go through `extra`.
      ...(sessionConfig ? { extra: nest(sessionConfig) } : {}),
    });

  let session: Session | null = null;
  let variant: "cpu" | "gpu" = "cpu";
  let gpuFallbackReason: string | null = null;
  if (cfg.device !== "cpu") {
    const gpu = manifest.variants.gpu;
    const eps = gpuProviders();
    if (!gpu) gpuFallbackReason = "the package has no gpu variant";
    else if (eps.length === 0) gpuFallbackReason = `no GPU runtime for ${process.platform}`;
    else {
      try {
        session = await create(gpu.file, eps, gpu.sessionConfig);
        variant = "gpu";
      } catch (err) {
        gpuFallbackReason = `${eps.join("/")}: ${(err as Error).message.split("\n")[0]!.slice(0, 200)}`;
      }
    }
    if (!session && cfg.device === "gpu") {
      throw new OnnxModelError("onnx_gpu_unavailable", `semantic.device is "gpu" but the GPU variant cannot run here: ${gpuFallbackReason}.`);
    }
  }
  if (!session) session = await create(manifest.variants.cpu.file, ["cpu"], manifest.variants.cpu.sessionConfig);
  const active = session;

  const tokenizerJson = JSON.parse(readFileSync(path.join(pkg, manifest.input.tokenizer), "utf8")) as {
    post_processor?: { type?: string; cls?: [string, number]; sep?: [string, number] };
    added_tokens?: Array<{ content: string; id: number }>;
  };
  const pp = tokenizerJson.post_processor;
  if (!pp?.cls || !pp.sep || !["RobertaProcessing", "BertProcessing"].includes(pp.type ?? "")) {
    throw new OnnxModelError("onnx_model_corrupt", `Semantic model "${cfg.model}": tokenizer post-processor ${pp?.type ?? "none"} is not supported (need cls/sep).`);
  }
  const [clsId, sepId] = [pp.cls[1], pp.sep[1]];
  const padId = tokenizerJson.added_tokens?.find((t) => t.content === "<pad>" || t.content === "[PAD]")?.id ?? 0;
  const tokenizer = new Tokenizer(tokenizerJson as object, {});
  const max = manifest.input.maxTokens;
  const truncated = { count: 0 };
  /** Same ids as the Python tokenizers library with truncation to maxTokens (specials included). */
  const encode = (text: string): number[] => {
    const inner = tokenizer.encode(text, { add_special_tokens: false }).ids as number[];
    if (inner.length > max - 2) truncated.count += 1;
    return [clsId, ...inner.slice(0, max - 2), sepId];
  };

  const batch = opts.batch ?? (variant === "gpu" ? 32 : 16);
  const cal = manifest.variants[variant]?.calibration?.bands;
  const calibration: Calibration | null = cal ? { bands: cal } : null;
  const dims = manifest.output.dimensions;
  const embedCalls = { count: 0 };
  return {
    modelId: `${manifest.id}@${manifest.version}:${variant}`,
    embedCalls,
    variant,
    gpuFallbackReason,
    manifest,
    calibration,
    truncated,
    async embed(texts: readonly string[]) {
      if (texts.length === 0) return [];
      embedCalls.count += 1;
      const ids = texts.map(encode);
      const order = ids.map((_, i) => i).sort((a, b) => ids[a]!.length - ids[b]!.length || a - b);
      const out: number[][] = new Array(texts.length);
      for (let k = 0; k < order.length; k += batch) {
        const idx = order.slice(k, k + batch);
        const width = Math.max(...idx.map((i) => ids[i]!.length));
        const inputIds = new BigInt64Array(idx.length * width).fill(BigInt(padId));
        const mask = new BigInt64Array(idx.length * width);
        idx.forEach((i, row) => {
          ids[i]!.forEach((id, col) => {
            inputIds[row * width + col] = BigInt(id);
            mask[row * width + col] = 1n;
          });
        });
        const result = await active.run({
          input_ids: new ort.Tensor("int64", inputIds, [idx.length, width]),
          attention_mask: new ort.Tensor("int64", mask, [idx.length, width]),
        });
        const emb = result[manifest.output.name];
        if (!emb || emb.dims[1] !== dims) throw new Error(`Semantic model "${cfg.model}": output ${manifest.output.name} has dims ${emb?.dims.join("x")}, manifest says ${dims}`);
        const data = emb.data as Float32Array;
        idx.forEach((i, row) => {
          out[i] = Array.from(data.subarray(row * dims, (row + 1) * dims));
        });
      }
      return out;
    },
    release: () => active.release(),
  };
}

/** `{ "session.disable_quant_qdq": "1" }` → `{ session: { disable_quant_qdq: "1" } }` (onnxruntime-node `extra`). */
function nest(flat: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let cur = out;
    for (const p of parts.slice(0, -1)) cur = (cur[p] ??= {}) as Record<string, unknown>;
    cur[parts.at(-1)!] = value;
  }
  return out;
}
