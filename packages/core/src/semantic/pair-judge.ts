/**
 * Pair judge (DUP-04, layer L4): a cross-encoder that reads two code pieces at once and gives the
 * probability that they do the same job (same / contains / concept) rather than share a pattern or do
 * different work. A model package (`dustmap-pair-judge/1`, built by dustmap-emb
 * data/judge/export_judge.py) is checked like an embedding package — every file with its SHA-256 —
 * and run in-process. Pairs are encoded as
 * the RoBERTa pair template `<s> A </s></s> B </s>` with longest-first truncation, the same ids as the
 * Python tokenizer the judge was trained with. The `gpu` variant (fp16) runs only when `nvidia-smi`
 * shows room for it: the card is shared with the user's own programs, and DirectML cannot be capped.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { OnnxModelError } from "./onnx-provider.js";
import { loadOrt } from "./similarity.js";

const JudgeManifest = z.object({
  schema: z.literal("dustmap-pair-judge/1"),
  id: z.string().min(1),
  version: z.string().min(1),
  private: z.boolean(),
  input: z.object({
    tokenizer: z.string().min(1),
    names: z.tuple([z.literal("input_ids"), z.literal("attention_mask")]),
    maxTokens: z.number().int().min(16),
  }),
  output: z.object({ name: z.string().min(1) }),
  variants: z
    .object({ cpu: z.object({ file: z.string().min(1) }).passthrough(), gpu: z.object({ file: z.string().min(1) }).passthrough().optional() })
    .passthrough(),
  /** Score from which a pair counts as the same job. */
  threshold: z.number().min(0).max(1),
  files: z.record(z.object({ sha256: z.string().regex(/^[0-9a-f]{64}$/), bytes: z.number().int().nonnegative() })),
});
export type JudgeManifest = z.infer<typeof JudgeManifest>;

export type PairJudge = {
  readonly manifest: JudgeManifest;
  readonly variant: "cpu" | "gpu";
  /** Why the gpu variant is not in use (auto), or null. */
  readonly gpuFallbackReason: string | null;
  /** Probability of the same job for each pair, in order. */
  score: (pairs: ReadonlyArray<readonly [string, string]>) => Promise<number[]>;
  release: () => Promise<void>;
};

/**
 * Longest-first truncation of a pair to `budget` tokens (Hugging Face tokenizers): the shorter side
 * keeps everything when it fits in half; otherwise both are cut to half, the first side taking the
 * odd token.
 */
export function truncatePair(a: readonly number[], b: readonly number[], budget: number): [number[], number[]] {
  if (a.length + b.length <= budget) return [[...a], [...b]];
  const half = Math.floor(budget / 2);
  if (a.length <= half) return [[...a], b.slice(0, budget - a.length)];
  if (b.length <= half) return [a.slice(0, budget - b.length), [...b]];
  return [a.slice(0, budget - half), b.slice(0, half)];
}

/** Read and check a judge package: manifest shape, every listed file present with its SHA-256. */
export function loadJudgePackage(dir: string, id: string): JudgeManifest {
  const pkg = path.join(dir, id);
  const manifestPath = path.join(pkg, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new OnnxModelError("onnx_model_missing", `Pair judge "${id}" is not installed (no ${manifestPath}). Dustmap never downloads models on its own.`);
  }
  let manifest: JudgeManifest;
  try {
    manifest = JudgeManifest.parse(JSON.parse(readFileSync(manifestPath, "utf8")));
  } catch (err) {
    throw new OnnxModelError("onnx_model_corrupt", `Pair judge "${id}": manifest.json is not a judge manifest (${(err as Error).message.slice(0, 300)}).`);
  }
  if (manifest.id !== id) throw new OnnxModelError("onnx_model_corrupt", `Pair judge "${id}": manifest says id "${manifest.id}".`);
  for (const f of [manifest.input.tokenizer, manifest.variants.cpu.file, ...(manifest.variants.gpu ? [manifest.variants.gpu.file] : [])]) {
    if (!manifest.files[f]) throw new OnnxModelError("onnx_model_corrupt", `Pair judge "${id}": ${f} is not listed in manifest.files.`);
  }
  for (const [name, meta] of Object.entries(manifest.files)) {
    const file = path.join(pkg, name);
    if (!existsSync(file)) throw new OnnxModelError("onnx_model_corrupt", `Pair judge "${id}": ${name} is missing.`);
    if (createHash("sha256").update(readFileSync(file)).digest("hex") !== meta.sha256) {
      throw new OnnxModelError("onnx_model_corrupt", `Pair judge "${id}": ${name} does not match its SHA-256 in manifest.json — reinstall the package.`);
    }
  }
  return manifest;
}

/** Free memory a judge on the GPU needs, in GB (fp16 weights ~0.25 GB plus activations of a batch). */
const GPU_ROOM_GB = 2.5;

/** Free GB on the first NVIDIA card as `nvidia-smi` sees it (every process counted), or null. */
export function nvidiaFreeGb(): number | null {
  try {
    const out = execFileSync("nvidia-smi", ["--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits", "--id=0"], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const [used, total] = out.trim().split(",").map(Number);
    return used !== undefined && total !== undefined && Number.isFinite(used) && Number.isFinite(total) ? (total - used) / 1024 : null;
  } catch {
    return null;
  }
}

/** Load, verify and start a judge package: the gpu variant when allowed and the card has room, else the CPU. */
export async function openPairJudge(
  dir: string,
  id: string,
  opts: { threads?: number; batch?: number; device?: "auto" | "gpu" | "cpu" } = {},
): Promise<PairJudge> {
  const manifest = loadJudgePackage(dir, id);
  const pkg = path.join(dir, id);
  let ort: Awaited<ReturnType<typeof loadOrt>>;
  let Tokenizer: (typeof import("@huggingface/tokenizers"))["Tokenizer"];
  try {
    ort = await loadOrt();
    ({ Tokenizer } = await import("@huggingface/tokenizers"));
  } catch (err) {
    throw new OnnxModelError("onnx_runtime_missing", `The pair judge needs onnxruntime-node and @huggingface/tokenizers (${(err as Error).message.slice(0, 200)}).`);
  }
  const create = (file: string, providers: string[]) =>
    ort.InferenceSession.create(path.join(pkg, file), {
      executionProviders: providers,
      graphOptimizationLevel: "all",
      logSeverityLevel: 3,
      ...(opts.threads ? { intraOpNumThreads: opts.threads } : {}),
    });
  const device = opts.device ?? "auto";
  let session: Awaited<ReturnType<typeof create>> | null = null;
  let variant: "cpu" | "gpu" = "cpu";
  let gpuFallbackReason: string | null = null;
  if (device !== "cpu") {
    const gpu = manifest.variants.gpu;
    const providers = process.platform === "win32" ? ["dml"] : process.platform === "linux" ? ["cuda"] : [];
    const free = nvidiaFreeGb();
    if (!gpu) gpuFallbackReason = "the package has no gpu variant";
    else if (providers.length === 0) gpuFallbackReason = `no GPU runtime for ${process.platform}`;
    else if (free === null) gpuFallbackReason = "nvidia-smi cannot tell how much GPU memory is free";
    else if (free < GPU_ROOM_GB) gpuFallbackReason = `only ${free.toFixed(1)} GB free on the GPU (needs ${GPU_ROOM_GB})`;
    else {
      try {
        session = await create(gpu.file, providers);
        variant = "gpu";
      } catch (err) {
        gpuFallbackReason = `${providers.join("/")}: ${(err as Error).message.split("\n")[0]!.slice(0, 200)}`;
      }
    }
    if (!session && device === "gpu") throw new OnnxModelError("onnx_gpu_unavailable", `Pair judge "${id}": the gpu variant cannot run here: ${gpuFallbackReason}.`);
  }
  session ??= await create(manifest.variants.cpu.file, ["cpu"]);
  const active = session;
  const tokenizerJson = JSON.parse(readFileSync(path.join(pkg, manifest.input.tokenizer), "utf8")) as {
    post_processor?: { type?: string; cls?: [string, number]; sep?: [string, number] };
    added_tokens?: Array<{ content: string; id: number }>;
  };
  const pp = tokenizerJson.post_processor;
  if (pp?.type !== "RobertaProcessing" || !pp.cls || !pp.sep) {
    throw new OnnxModelError("onnx_model_corrupt", `Pair judge "${id}": tokenizer post-processor ${pp?.type ?? "none"} is not the RoBERTa pair template.`);
  }
  const cls = pp.cls[1];
  const sep = pp.sep[1];
  const pad = tokenizerJson.added_tokens?.find((t) => t.content === "<pad>")?.id ?? 1;
  const tokenizer = new Tokenizer(tokenizerJson as object, {});
  const budget = manifest.input.maxTokens - 4;
  const encode = (a: string, b: string): number[] => {
    const [ta, tb] = truncatePair(
      tokenizer.encode(a, { add_special_tokens: false }).ids as number[],
      tokenizer.encode(b, { add_special_tokens: false }).ids as number[],
      budget,
    );
    return [cls, ...ta, sep, sep, ...tb, sep];
  };
  const batch = opts.batch ?? 8;
  return {
    manifest,
    variant,
    gpuFallbackReason,
    async score(pairs) {
      const ids = pairs.map(([a, b]) => encode(a, b));
      // Length-sorted batches: padding is masked, so a pair's score does not depend on its neighbours.
      const order = ids.map((_, i) => i).sort((x, y) => ids[x]!.length - ids[y]!.length || x - y);
      const out = new Array<number>(pairs.length);
      for (let k = 0; k < order.length; k += batch) {
        const idx = order.slice(k, k + batch);
        const width = Math.max(...idx.map((i) => ids[i]!.length));
        const inputIds = new BigInt64Array(idx.length * width).fill(BigInt(pad));
        const mask = new BigInt64Array(idx.length * width);
        idx.forEach((i, row) => {
          ids[i]!.forEach((tok, col) => {
            inputIds[row * width + col] = BigInt(tok);
            mask[row * width + col] = 1n;
          });
        });
        const result = await active.run({
          input_ids: new ort.Tensor("int64", inputIds, [idx.length, width]),
          attention_mask: new ort.Tensor("int64", mask, [idx.length, width]),
        });
        const scores = result[manifest.output.name]!.data as Float32Array;
        idx.forEach((i, row) => (out[i] = scores[row]!));
      }
      return out;
    },
    release: async () => {
      await active.release();
    },
  };
}
