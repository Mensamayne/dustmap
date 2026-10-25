/**
 * dustmap.config.json schema — project-specific knowledge lives here, never in package source.
 */
import { z } from "zod";

/**
 * Declared architecture layer — paths are globs over repo-relative POSIX paths;
 * `mayImport` lists other layer names this layer is allowed to import (same layer always OK).
 * Empty `layers` means no layer-violation findings (no defaults baked into packages).
 */
export const LayerRule = z
  .object({
    name: z.string().min(1),
    paths: z.array(z.string().min(1)).min(1),
    mayImport: z.array(z.string().min(1)).default([]),
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
 * Duplicates by normalization (DUP-01, layer L1): no model, certain by construction. Script units
 * identical after renaming their local names; CSS rules equivalent by duplication types I–III.
 */
export const ClonesConfig = z
  .object({
    /** Smallest function / class considered, in normalized tokens. */
    minTokens: z.number().int().positive().default(40),
    /** Smallest function / class considered, in source lines. */
    minLines: z.number().int().positive().default(4),
    /** A whole CSS rule takes part when it sets at least this many property families (`margin-*` = one). */
    cssMinRuleDeclarations: z.number().int().positive().default(2),
    /** Shared declaration sets inside one stylesheet are reported from this many property families. */
    cssMinSharedProperties: z.number().int().positive().default(3),
    /** …and only when extracting them saves at least this many declarations (property families × (|rules| − 1)). */
    cssMinSavedDeclarations: z.number().int().positive().default(8),
    /** …and at most this many opportunities per stylesheet, best saving first (FSE 2014 ranking). */
    cssMaxSharedSetsPerFile: z.number().int().positive().default(3),
    /** Near copies (DUP-02, L2): smallest unit, in normalized lines that carry more than brackets. */
    nearMinLines: z.number().int().positive().default(5),
    /** Near copy: shared tokens / tokens of the larger unit (NiCad's 0.3 difference threshold). */
    nearMinSimilarity: z.number().gt(0).lte(1).default(0.7),
    /** Contains: shared tokens / tokens of the smaller unit. */
    containMinCoverage: z.number().gt(0).lte(1).default(0.9),
    /** L5 (DUP-05): name the original of each group from git history (read-only). */
    copyDirection: z.boolean().default(true),
    /**
     * …and date members created the same day, or sharing a file, by their own lines (`git blame -L`), at
     * most this many times per scan. Off by default: on a 2.5k-commit monorepo 2000 blames took 248 s and
     * added 5 of 269 directions over file dates alone (2.7 s); such members simply get no direction.
     */
    maxBlames: z.number().int().nonnegative().default(0),
    /**
     * Highest confidence of a token copy (jscpd) no layer that reads whole units confirms (DUP-07). Token
     * runs ignore unit boundaries and catch boilerplate and import lists: on a reviewed sample such
     * findings were right ~6 times in 10, against 17/17 for high findings a unit-level layer confirmed.
     */
    tokenCopyAloneMax: z.enum(["low", "medium", "high"]).default("medium"),
  })
  .strict();
export type ClonesConfig = z.infer<typeof ClonesConfig>;

/**
 * Semantic (embedding) duplicate detection — default (EMB-10): Dustmap's own ONNX model package
 * in-process, offline, with calibrated bands (EMB-09). The default id is the public package
 * (`dustmap model pull dustmap-same-meaning-public`); not installed, the layer is off with a note saying how
 * to turn it on (REL-02).
 */
export const SemanticConfig = z
  .object({
    /**
     * `onnx` = a Dustmap model package run in-process (ONNX Runtime, no network); `http` = an
     * OpenAI-compatible embeddings URL; `none` = off.
     */
    provider: z.enum(["onnx", "http", "none"]).default("onnx"),
    /** Model: onnx package id (installed under modelDir), or the HTTP model field. */
    model: z.string().min(1).default("dustmap-same-meaning-public"),
    /**
     * `onnx` only: where model packages live (`<modelDir>/<model>/manifest.json`). Default: the user
     * cache, `$DUSTMAP_MODELS_DIR` or `~/.cache/dustmap/models`. Never inside the scanned repo's source.
     */
    modelDir: z.string().min(1).optional(),
    /**
     * `onnx` only: `auto` = the package's GPU variant when a GPU runtime works here (DirectML on
     * Windows, CUDA on Linux), otherwise its CPU variant; `gpu` = GPU or fail; `cpu` = CPU always.
     */
    device: z.enum(["auto", "gpu", "cpu"]).default("auto"),
    /**
     * Minimum cosine similarity to report. Unset: `onnx` uses the model package's calibration (its
     * `medium` band, EMB-09 — every model has its own scale); `http` uses 0.82 (DUST-15 spike).
     */
    threshold: z.number().gt(0).lte(1).optional(),
    /** Minimum function tokens before a function is considered by extractors. */
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

/** Place ranking — weights live in config, never hard-coded per customer repo. */
export const RankingConfig = z
  .object({
    topN: z.number().int().positive().default(10),
    diversityBonus: z.number().nonnegative().default(3),
    categoryWeights: z
      .object({
        "dead-code": z.number().nonnegative().default(1),
        duplicate: z.number().nonnegative().default(1.2),
        "semantic-duplicate": z.number().nonnegative().default(1.1),
        "refactor-signal": z.number().nonnegative().default(1.3),
        structure: z.number().nonnegative().default(1.4),
      })
      .default({}),
    confidenceWeights: z
      .object({
        low: z.number().nonnegative().default(0.5),
        medium: z.number().nonnegative().default(1),
        high: z.number().nonnegative().default(1.5),
      })
      .default({}),
  })
  .strict();
export type RankingConfig = z.infer<typeof RankingConfig>;

/** Baseline ratchet — only findings at or above minConfidence count as new. */
export const RatchetConfig = z
  .object({
    minConfidence: z.enum(["low", "medium", "high"]).default("medium"),
  })
  .strict();
export type RatchetConfig = z.infer<typeof RatchetConfig>;

/**
 * The pair judge (layer L4, V1-01): reads both pieces of a candidate pair and gives the probability that
 * they do the same job; same-meaning groups it rejects drop to low, copies it confirms rise to high.
 *   onnx       a Dustmap model package under semantic.modelDir (not installed = similarity alone)
 *   openai     any OpenAI-compatible chat API (OpenAI, or a local vLLM / Ollama / llama.cpp server)
 *   anthropic  the Anthropic Messages API (Claude)
 *   none       no judge
 * API keys only from the environment (DUSTMAP_JUDGE_API_KEY, OPENAI_API_KEY or ANTHROPIC_API_KEY), never
 * from this file; a non-loopback URL needs allowRemote (code pairs leave the machine).
 */
export const JudgeConfig = z
  .object({
    /** Default `none`: there is no public judge package yet; pick an API, a local server or a package (docs/MODELS.md). */
    provider: z.enum(["onnx", "openai", "anthropic", "none"]).default("none"),
    /** onnx: the package id; openai / anthropic: the API model name. Required with any provider but none. */
    model: z.string().min(1).optional(),
    /** API base URL (default the provider's own; e.g. http://127.0.0.1:11434/v1 for a local server). */
    url: z.string().url().optional(),
    /** Allow a non-loopback URL: code pairs leave this machine. */
    allowRemote: z.boolean().default(false),
    /** onnx only: `auto` = the GPU variant when the card has room (≥ 2.5 GB free), else the CPU. */
    device: z.enum(["auto", "gpu", "cpu"]).default("auto"),
    /** New pairs an API judge reads per scan (cost cap); cached verdicts are free. */
    maxPairs: z.number().int().positive().default(400),
    /**
     * Lowest similarity band a judged semantic group is reported from (medium-and-up). `high`: below it the
     * group stays low even when the judge says yes — on real code that band held mostly sibling helpers of
     * one file (reviewed: high band 16/17 duplicates, medium band ~1 in 4; DUP-08).
     */
    minBand: z.enum(["high", "medium"]).default("high"),
  })
  .strict();
export type JudgeConfig = z.infer<typeof JudgeConfig>;

/**
 * File-queue briefs sink (DUST-13) — paths and id prefix live in config so any
 * repo with a compatible queue.json can wire the sink without package changes.
 */
export const BriefsSinkDefaults = z
  .object({
    segment: z.string().min(1),
    kind: z.enum(["feature", "bug"]).default("feature"),
    /** Queue layer for ordering; default high so hygiene tasks sort after product work. */
    layer: z.number().int().default(100),
    epic: z.string().min(1).optional(),
    severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  })
  .strict();
export type BriefsSinkDefaults = z.infer<typeof BriefsSinkDefaults>;

export const BriefsSinkConfig = z
  .object({
    queuePath: z.string().min(1),
    briefsDir: z.string().min(1),
    /** Optional path to a markdown template; omit to use the built-in Dustmap template. */
    template: z.string().min(1).optional(),
    idPrefix: z.string().min(1),
    defaults: BriefsSinkDefaults,
  })
  .strict();
export type BriefsSinkConfig = z.infer<typeof BriefsSinkConfig>;

export const SinksConfig = z
  .object({
    briefs: BriefsSinkConfig.optional(),
  })
  .strict()
  .default({});
export type SinksConfig = z.infer<typeof SinksConfig>;

export const DustmapConfig = z
  .object({
    include: z.array(z.string().min(1)).default([
      "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
      // Stylesheets reach only the CSS duplicate layer (DUP-01); script detectors never see them.
      "**/*.{css,scss}",
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
    clones: ClonesConfig.default({}),
    classify: ClassifyConfig.default({}),
    ranking: RankingConfig.default({}),
    ratchet: RatchetConfig.default({}),
    judge: JudgeConfig.default({}),
    sinks: SinksConfig,
    /** Relative to scanned repo, or absolute path (may lie outside the repo). */
    outputDir: z.string().min(1).default(".dustmap"),
  })
  .strict();
export type DustmapConfig = z.infer<typeof DustmapConfig>;

/** Keys a released config may still carry, and where their setting lives now (V1-01). */
const MOVED_KEYS: Readonly<Record<string, string>> = {
  "semantic.pairJudge": "judge.provider + judge.model",
  "semantic.judgedMinBand": "judge.minBand",
  "judge.enabled": "judge.provider (\"none\" = no judge)",
};

export function formatConfigError(err: z.ZodError): string {
  return err.issues
    .map((i) => {
      const where = i.path.length ? i.path.join(".") : "(root)";
      if (i.code === "unrecognized_keys") {
        const moved = i.keys.map((k) => [k, MOVED_KEYS[[...i.path, k].join(".")]] as const).filter(([, to]) => to);
        if (moved.length) return `${where}: ${i.message} — moved: ${moved.map(([k, to]) => `${k} → ${to}`).join(", ")}`;
      }
      return `${where}: ${i.message}`;
    })
    .join("; ");
}
