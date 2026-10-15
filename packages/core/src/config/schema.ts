/**
 * dustmap.config.json schema — project-specific knowledge lives here, never in package source.
 */
import { z } from "zod";

export const LayerRule = z
  .object({
    name: z.string().min(1),
    patterns: z.array(z.string().min(1)).min(1),
  })
  .strict();
export type LayerRule = z.infer<typeof LayerRule>;

export const AdapterConfig = z
  .object({
    enabled: z.boolean().default(true),
    options: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type AdapterConfig = z.infer<typeof AdapterConfig>;

/**
 * Semantic (embedding) duplicate detection — defaults follow the DUST-15 spike decision:
 * local jina model via jscpd, threshold 0.82, confidence medium/low only.
 */
export const SemanticConfig = z
  .object({
    /** `local` = jscpd built-in model; `http` = OpenAI-compatible embeddings URL; `none` = off. */
    provider: z.enum(["local", "http", "none"]).default("local"),
    /** Embedding model id (local jscpd model name, or HTTP model field). */
    model: z.string().min(1).default("jina-embeddings-v2-base-code"),
    /** Minimum cosine similarity within one language to report (spike: 0.82). */
    threshold: z.number().gt(0).lte(1).default(0.82),
    /** Minimum function tokens before a function is considered (passed to jscpd / extractors). */
    minTokens: z.number().int().positive().default(50),
    /** OpenAI-compatible embeddings base URL (e.g. http://127.0.0.1:11434/v1). Required for `http`. */
    url: z.string().url().optional(),
    /** Allow non-loopback URLs for `http` (code would leave the machine). Default false. */
    allowRemote: z.boolean().default(false),
  })
  .strict();
export type SemanticConfig = z.infer<typeof SemanticConfig>;

/** Extra role globs for what generic rules cannot know; generic rules still apply to everything else. */
export const ClassifyConfig = z
  .object({
    /** Files larger than this are `oversized` and never read. */
    maxFileBytes: z.number().int().positive().default(300_000),
    generated: z.array(z.string().min(1)).default([]),
    vendored: z.array(z.string().min(1)).default([]),
    test: z.array(z.string().min(1)).default([]),
    fixture: z.array(z.string().min(1)).default([]),
  })
  .strict();
export type ClassifyConfig = z.infer<typeof ClassifyConfig>;

export const DustmapConfig = z
  .object({
    include: z.array(z.string().min(1)).default([
      "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
    ]),
    exclude: z.array(z.string().min(1)).default([
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/.dustmap/**",
      "**/coverage/**",
    ]),
    entryPoints: z.array(z.string().min(1)).default([]),
    layers: z.array(LayerRule).default([]),
    adapters: z.record(z.string(), AdapterConfig).default({}),
    semantic: SemanticConfig.default({}),
    classify: ClassifyConfig.default({}),
    /** Relative to scanned repo, or absolute path (may lie outside the repo). */
    outputDir: z.string().min(1).default(".dustmap"),
  })
  .strict();
export type DustmapConfig = z.infer<typeof DustmapConfig>;

export function formatConfigError(err: z.ZodError): string {
  return err.issues
    .map((i) => {
      const where = i.path.length ? i.path.join(".") : "(root)";
      return `${where}: ${i.message}`;
    })
    .join("; ");
}
