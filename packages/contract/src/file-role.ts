/**
 * File roles — what each scanned file actually is. Detectors work on `source` by default;
 * the other roles exist so the report can say what was skipped and why.
 */
import { z } from "zod";

export const FileRole = z.enum([
  "source",
  "test",
  "fixture",
  "declaration",
  "generated",
  "vendored",
  "minified",
  "oversized",
]);
export type FileRole = z.infer<typeof FileRole>;

export const FileRoleCounts = z.record(FileRole, z.number().int().nonnegative());
export type FileRoleCounts = z.infer<typeof FileRoleCounts>;

export const ScanFiles = z
  .object({
    total: z.number().int().nonnegative(),
    byRole: FileRoleCounts,
  })
  .strict();
export type ScanFiles = z.infer<typeof ScanFiles>;
