/**
 * Human/agent decisions keyed by finding fingerprint. Stored in the user's repo (YAML), not invented by scanners.
 */
import { z } from "zod";

export const DecisionVerdict = z.enum(["keep", "fix", "wontfix"]);
export type DecisionVerdict = z.infer<typeof DecisionVerdict>;

export const Decision = z
  .object({
    fingerprint: z
      .string()
      .regex(/^[a-f0-9]{16}$/, "fingerprint must be 16 lowercase hex chars"),
    verdict: DecisionVerdict,
    reason: z.string().min(10, "reason must be at least 10 characters"),
    by: z.string().min(1),
    at: z.string().datetime({ offset: true }),
  })
  .strict();
export type Decision = z.infer<typeof Decision>;

export const DecisionFile = z
  .object({
    schema: z.literal("dustmap.decisions/v1"),
    decisions: z.array(Decision),
  })
  .strict();
export type DecisionFile = z.infer<typeof DecisionFile>;
