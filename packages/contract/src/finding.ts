/**
 * Finding schema — one dust signal with stable fingerprint, evidence, and a non-destructive suggested action.
 * Adapters and signal extractors must emit this shape; surfaces never invent parallel finding types.
 */
import { z } from "zod";
import { RepoRelativePath } from "./paths.js";

export const FindingCategory = z.enum([
  "dead-code",
  "duplicate",
  "semantic-duplicate",
  "refactor-signal",
  "structure",
]);
export type FindingCategory = z.infer<typeof FindingCategory>;

/** Closed kind list. New kinds require a contract bump, never ad-hoc strings from tools. */
export const FindingKind = z.enum([
  "unused-file",
  "unused-export",
  "unused-type",
  "unused-dependency",
  "unlisted-dependency",
  "clone-cluster",
  "semantic-cluster",
  "complexity",
  "large-file",
  "long-parameter-list",
  "boolean-params",
  "repeated-condition",
  "hotspot",
  "co-change",
  "fix-density",
  "cycle",
  "god-module",
  "layer-violation",
  "false-green-test",
]);
export type FindingKind = z.infer<typeof FindingKind>;

export const Confidence = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof Confidence>;

/** Soft next step for an agent — never “delete” or auto-fix. */
export const SuggestedAction = z.enum(["review", "decide", "verify"]);
export type SuggestedAction = z.infer<typeof SuggestedAction>;

export const Location = z.object({
  path: RepoRelativePath,
  startLine: z.number().int().positive().optional(),
  endLine: z.number().int().positive().optional(),
  symbol: z.string().min(1).optional(),
});
export type Location = z.infer<typeof Location>;

export const Evidence = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});
export type Evidence = z.infer<typeof Evidence>;

/**
 * Optional LLM judge note (DUST-14). Informational only — never changes confidence or ranking.
 * Omitted when the judge is disabled (default).
 */
export const JudgementVerdict = z.enum([
  "real-duplicate",
  "intentional-pattern",
  "uncertain",
]);
export type JudgementVerdict = z.infer<typeof JudgementVerdict>;

export const Judgement = z
  .object({
    verdict: JudgementVerdict,
    reason: z.string().min(1),
    model: z.string().min(1),
  })
  .strict();
export type Judgement = z.infer<typeof Judgement>;

export const Finding = z
  .object({
    fingerprint: z
      .string()
      .regex(/^[a-f0-9]{16}$/, "fingerprint must be 16 lowercase hex chars"),
    kind: FindingKind,
    category: FindingCategory,
    locations: z.array(Location).min(1),
    evidence: z.array(Evidence).default([]),
    confidence: Confidence,
    suggestedAction: SuggestedAction,
    verifyHint: z.string().min(1),
    source: z.string().min(1),
    judgement: Judgement.optional(),
  })
  .strict();
export type Finding = z.infer<typeof Finding>;
