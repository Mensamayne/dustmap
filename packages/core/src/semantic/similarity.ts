/**
 * Every pair of unit vectors with cosine ≥ threshold — exact, no approximate index. Small sets are
 * scored in plain JS; large ones as blocked matrix products (rows × all columns) in ONNX Runtime,
 * which already ships with Dustmap for the `onnx` provider: 30k functions × 768 dimensions is a few
 * seconds there instead of many minutes in JS. The one-node MatMul graph is written here, in a few
 * lines of protobuf, rather than shipped as a binary file.
 */
const JS_LIMIT = 1500;
const BLOCK = 1024;

export type ScoredPair = { i: number; j: number; similarity: number };

type Ort = typeof import("onnxruntime-node");

/** onnxruntime-node is CommonJS: its namespace is `default` under some loaders, the module itself under others. */
export async function loadOrt(): Promise<Ort> {
  const mod = (await import("onnxruntime-node")) as Ort & { default?: Ort };
  return mod.default ?? mod;
}

function dot(a: Float32Array, ao: number, b: Float32Array, bo: number, d: number): number {
  let s = 0;
  for (let k = 0; k < d; k++) s += a[ao + k]! * b[bo + k]!;
  return s;
}

/** Pairs (i < j) with dot(v_i, v_j) ≥ threshold; vectors must be unit length. Sorted by i, then j. */
export async function pairsAtLeast(vectors: readonly (readonly number[])[], threshold: number): Promise<ScoredPair[]> {
  const n = vectors.length;
  if (n < 2) return [];
  const d = vectors[0]!.length;
  const flat = new Float32Array(n * d);
  vectors.forEach((v, i) => flat.set(v, i * d));
  const out: ScoredPair[] = [];
  if (n <= JS_LIMIT) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const s = dot(flat, i * d, flat, j * d, d);
        if (s >= threshold) out.push({ i, j, similarity: s });
      }
    }
    return out;
  }
  const ort = await loadOrt();
  const session = await ort.InferenceSession.create(matmulModel(), { executionProviders: ["cpu"], logSeverityLevel: 3 });
  try {
    // Bᵀ once: [d, n].
    const bt = new Float32Array(d * n);
    for (let i = 0; i < n; i++) for (let k = 0; k < d; k++) bt[k * n + i] = flat[i * d + k]!;
    const right = new ort.Tensor("float32", bt, [d, n]);
    for (let start = 0; start < n; start += BLOCK) {
      const rows = Math.min(BLOCK, n - start);
      const left = new ort.Tensor("float32", flat.subarray(start * d, (start + rows) * d), [rows, d]);
      const res = await session.run({ a: left, b: right });
      const s = res.s!.data as Float32Array;
      for (let r = 0; r < rows; r++) {
        const i = start + r;
        const base = r * n;
        for (let j = i + 1; j < n; j++) {
          const v = s[base + j]!;
          if (v >= threshold) out.push({ i, j, similarity: v });
        }
      }
    }
  } finally {
    await session.release();
  }
  return out;
}

// --- a one-node ONNX model (MatMul: a[m,d] × b[d,n] → s[m,n]) encoded as protobuf ----------------

function varint(n: number): number[] {
  const out: number[] = [];
  let v = n;
  while (v > 127) {
    out.push((v & 127) | 128);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return out;
}
const field = (no: number, wire: number) => varint(no * 8 + wire);
const num = (no: number, v: number) => [...field(no, 0), ...varint(v)];
const bytes = (no: number, b: number[]) => [...field(no, 2), ...varint(b.length), ...b];
const str = (no: number, s: string) => bytes(no, [...new TextEncoder().encode(s)]);

/** ValueInfoProto: float tensor with symbolic dims. */
function valueInfo(name: string, dims: string[]): number[] {
  const shape = dims.flatMap((dp) => bytes(1, str(2, dp))); // TensorShapeProto.dim { dim_param }
  const tensorType = [...num(1, 1), ...bytes(2, shape)]; // elem_type FLOAT, shape
  const type = bytes(1, tensorType); // TypeProto.tensor_type
  return [...str(1, name), ...bytes(2, type)];
}

let cachedModel: Uint8Array | null = null;
function matmulModel(): Uint8Array {
  if (cachedModel) return cachedModel;
  const node = [...str(1, "a"), ...str(1, "b"), ...str(2, "s"), ...str(3, "matmul"), ...str(4, "MatMul")];
  const graph = [
    ...bytes(1, node),
    ...str(2, "dustmap-similarity"),
    ...bytes(11, valueInfo("a", ["m", "d"])),
    ...bytes(11, valueInfo("b", ["d", "n"])),
    ...bytes(12, valueInfo("s", ["m", "n"])),
  ];
  const opset = [...str(1, ""), ...num(2, 17)];
  cachedModel = new Uint8Array([...num(1, 8), ...str(2, "dustmap"), ...bytes(7, graph), ...bytes(8, opset)]);
  return cachedModel;
}
