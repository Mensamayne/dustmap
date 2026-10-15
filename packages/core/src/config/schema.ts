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

export const SemanticConfig = z
  .object({
    provider: z.enum(["local", "none"]).default("none"),
  })
  .strict();
export type SemanticConfig = z.infer<typeof SemanticConfig>;

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
    semantic: SemanticConfig.default({ provider: "none" }),
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
