/**
 * PAIR epic: pair-level head on top of frozen embeddings. Maps gold labels to three report classes
 * and builds the feature vector shared by training (Python) and product (ONNX / TS).
 */
import { loadOrt } from "./similarity.js";

/** Classes the pair head predicts for the product report. */
export const PAIR_HEAD_CLASSES = ["same", "pattern", "other"] as const;
export type PairHeadClass = (typeof PAIR_HEAD_CLASSES)[number];

export type GoldLikeLabel = "same" | "contains" | "concept" | "pattern" | "different";

/** Gold / CON labels → pair-head training & report classes (soft positives are not "report as copy"). */
export function mapGoldLabelToPairClass(label: GoldLikeLabel): PairHeadClass {
  if (label === "same") return "same";
  if (label === "pattern") return "pattern";
  return "other";
}

export function pairClassIndex(c: PairHeadClass): number {
  return PAIR_HEAD_CLASSES.indexOf(c);
}

/**
 * Features for one pair of L2-ish embeddings: [a; b; |a-b|; a⊙b]. Length = 4 * dim.
 * Must match dustmap-emb/pair_head.py `pair_features`.
 */
export function pairFeatures(a: readonly number[], b: readonly number[]): Float32Array {
  const d = Math.min(a.length, b.length);
  const out = new Float32Array(4 * d);
  for (let i = 0; i < d; i++) {
    const x = a[i]!;
    const y = b[i]!;
    out[i] = x;
    out[d + i] = y;
    out[2 * d + i] = Math.abs(x - y);
    out[3 * d + i] = x * y;
  }
  return out;
}

export type PairHeadScores = {
  /** Softmax probabilities in PAIR_HEAD_CLASSES order. */
  probs: [number, number, number];
  predicted: PairHeadClass;
  /** P(same) — used as report similarity when the head is active. */
  pSame: number;
};

function softmax3(logits: readonly number[]): [number, number, number] {
  const m = Math.max(logits[0]!, logits[1]!, logits[2]!);
  const e0 = Math.exp(logits[0]! - m);
  const e1 = Math.exp(logits[1]! - m);
  const e2 = Math.exp(logits[2]! - m);
  const s = e0 + e1 + e2;
  return [e0 / s, e1 / s, e2 / s];
}

export type PairHeadSession = {
  score(a: readonly number[], b: readonly number[]): Promise<PairHeadScores>;
  release(): Promise<void>;
};

type OrtTensor = { new (type: string, data: Float32Array, dims: number[]): unknown };
type OrtSession = {
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array | number[] }>>;
  release?(): Promise<void>;
};

/**
 * Load an ONNX pair-head graph. Expected I/O: input `features` [1, 4*dim] float32 → output `logits` [1, 3].
 */
export async function openPairHeadSession(
  modelPath: string,
  dims: number,
  executionProviders: string[] = ["cpu"],
): Promise<PairHeadSession> {
  const ort = await loadOrt();
  const session = (await ort.InferenceSession.create(modelPath, {
    executionProviders,
    logSeverityLevel: 3,
  })) as OrtSession;
  const Tensor = ort.Tensor as unknown as OrtTensor;
  const featLen = 4 * dims;

  return {
    async score(a, b) {
      if (a.length < dims || b.length < dims) {
        throw new Error(`pair head expects dim ${dims}, got ${a.length}/${b.length}`);
      }
      const feats = pairFeatures(a.slice(0, dims), b.slice(0, dims));
      if (feats.length !== featLen) throw new Error(`pair features length ${feats.length} != ${featLen}`);
      const feed = { features: new Tensor("float32", feats, [1, featLen]) };
      const out = await session.run(feed);
      const raw = out["logits"] ?? out[Object.keys(out)[0]!];
      if (!raw) throw new Error("pair head output missing logits");
      const data = raw.data instanceof Float32Array ? raw.data : Float32Array.from(raw.data);
      const probs = softmax3([data[0]!, data[1]!, data[2]!]);
      let best = 0;
      if (probs[1]! > probs[best]!) best = 1;
      if (probs[2]! > probs[best]!) best = 2;
      return { probs, predicted: PAIR_HEAD_CLASSES[best]!, pSame: probs[0]! };
    },
    async release() {
      await session.release?.();
    },
  };
}

/** Cosine baseline: map similarity to a pseudo three-way decision for meter comparison. */
export function cosinePairBaseline(
  similarity: number,
  sameFloor: number,
  patternFloor: number,
): PairHeadClass {
  if (similarity >= sameFloor) return "same";
  if (similarity >= patternFloor) return "pattern";
  return "other";
}
