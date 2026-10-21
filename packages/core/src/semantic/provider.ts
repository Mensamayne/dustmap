/**
 * Embedding providers for semantic duplicate detection. Local path uses jscpd's built-in model
 * (pair detection, not raw vectors); HTTP path uses an OpenAI-compatible embeddings API; the `onnx`
 * path (a Dustmap model package in-process) lives in onnx-provider.ts.
 * Non-loopback URLs require explicit `allowRemote: true` — otherwise zero network calls.
 */
import type { SemanticConfig } from "../config/schema.js";

export type EmbeddingProvider = {
  /** Stable model id used in vector-cache keys. */
  readonly modelId: string;
  /** How many `embed` batches were sent (tests assert second scan stays at 0). */
  readonly embedCalls: { count: number };
  embed: (texts: readonly string[]) => Promise<number[][]>;
};

export class RemoteEmbeddingsForbiddenError extends Error {
  readonly code = "semantic_remote_forbidden";
  constructor(url: string) {
    super(
      `Semantic HTTP provider URL is not loopback (${url}). Set semantic.allowRemote: true to send code embeddings off this machine.`,
    );
    this.name = "RemoteEmbeddingsForbiddenError";
  }
}

export class SemanticProviderConfigError extends Error {
  readonly code = "semantic_provider_config";
  constructor(message: string) {
    super(message);
    this.name = "SemanticProviderConfigError";
  }
}

/** True when host is localhost / 127.0.0.1 / ::1. */
export function isLoopbackUrl(urlStr: string): boolean {
  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<unknown> }>;

/**
 * OpenAI-compatible embeddings (`POST {url}/embeddings` or url already ending with /embeddings).
 * API key from `DUSTMAP_SEMANTIC_API_KEY` or `JSCPD_SEMANTIC_API_KEY` only — never from config.
 */
export function createOpenAiCompatibleProvider(
  cfg: Pick<SemanticConfig, "model" | "url" | "allowRemote">,
  fetchImpl: FetchLike = fetch as FetchLike,
): EmbeddingProvider {
  if (!cfg.url) {
    throw new SemanticProviderConfigError(
      'semantic.provider is "http" but semantic.url is missing (e.g. http://127.0.0.1:11434/v1).',
    );
  }
  if (!cfg.allowRemote && !isLoopbackUrl(cfg.url)) {
    throw new RemoteEmbeddingsForbiddenError(cfg.url);
  }

  const embedCalls = { count: 0 };
  const base = cfg.url.replace(/\/$/, "");
  const endpoint = /\/embeddings$/i.test(base) ? base : `${base}/embeddings`;
  const modelId = cfg.model;

  return {
    modelId,
    embedCalls,
    async embed(texts: readonly string[]) {
      if (texts.length === 0) return [];
      embedCalls.count += 1;
      const key =
        process.env.DUSTMAP_SEMANTIC_API_KEY?.trim() ||
        process.env.JSCPD_SEMANTIC_API_KEY?.trim() ||
        "";
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (key) headers.authorization = `Bearer ${key}`;

      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ model: modelId, input: [...texts] }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Semantic embeddings HTTP ${res.status}: ${body.slice(0, 400)}`);
      }
      const json = (await res.json()) as {
        data?: Array<{ embedding?: number[]; index?: number }>;
      };
      const rows = json.data ?? [];
      const ordered = [...rows].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      if (ordered.length !== texts.length) {
        throw new Error(
          `Semantic embeddings returned ${ordered.length} vectors for ${texts.length} inputs`,
        );
      }
      return ordered.map((row) => {
        if (!row.embedding || row.embedding.length === 0) {
          throw new Error("Semantic embeddings response missing embedding[]");
        }
        return row.embedding;
      });
    },
  };
}

const JS_KEYWORDS = new Set(
  "export function async await const let var return if else for while of in class extends new typeof void null undefined true false number string boolean promise".split(
    " ",
  ),
);

/** Collapse user identifiers so structurally similar functions embed near each other in tests. */
function normalizeForMemoryEmbed(text: string): string {
  return text.replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (w) => {
    const lower = w.toLowerCase();
    if (JS_KEYWORDS.has(lower)) return lower;
    return "id";
  });
}

/**
 * Deterministic bag-of-tokens embedder for tests and offline fixtures (not the jina model).
 * Similar structure → high cosine after identifier normalization; unrelated text → low.
 */
export function createMemoryEmbeddingProvider(modelId = "memory-test-embed"): EmbeddingProvider {
  const embedCalls = { count: 0 };
  return {
    modelId,
    embedCalls,
    async embed(texts: readonly string[]) {
      embedCalls.count += 1;
      return texts.map((t) => bagOfTokensVector(normalizeForMemoryEmbed(t)));
    },
  };
}

function bagOfTokensVector(text: string): number[] {
  const dim = 64;
  const v = new Array<number>(dim).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9_]+/).filter((t) => t.length > 0);
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % dim;
    v[idx]! += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export type ProviderKind = "local" | "http" | "onnx" | "none" | "memory";

/**
 * Build an embedding provider from config. `local` uses a memory embedder for unit fixtures;
 * production local pair-finding goes through jscpd (see `jscpd-semantic.ts`). `memory` is tests-only.
 */
export function createEmbeddingProvider(
  cfg: SemanticConfig,
  opts?: { fetch?: FetchLike; kind?: ProviderKind },
): EmbeddingProvider | null {
  const kind = opts?.kind ?? cfg.provider;
  if (kind === "none") return null;
  if (kind === "http") {
    return createOpenAiCompatibleProvider(cfg, opts?.fetch);
  }
  if (kind === "memory") {
    return createMemoryEmbeddingProvider(cfg.model);
  }
  if (kind === "onnx") {
    // Loading and verifying a model package is asynchronous — see openOnnxProvider (onnx-provider.ts).
    throw new SemanticProviderConfigError('semantic.provider "onnx" is opened with openOnnxProvider(), not createEmbeddingProvider().');
  }
  // local: vector path for tests / small fixtures; jscpd semantic is preferred in the adapter.
  return createMemoryEmbeddingProvider(`local:${cfg.model}`);
}

/** Assert http config before any fetch — used by tests that must prove zero requests. */
export function assertHttpProviderAllowed(cfg: SemanticConfig): void {
  if (cfg.provider !== "http") return;
  if (!cfg.url) {
    throw new SemanticProviderConfigError(
      'semantic.provider is "http" but semantic.url is missing (e.g. http://127.0.0.1:11434/v1).',
    );
  }
  if (!cfg.allowRemote && !isLoopbackUrl(cfg.url)) {
    throw new RemoteEmbeddingsForbiddenError(cfg.url);
  }
}
