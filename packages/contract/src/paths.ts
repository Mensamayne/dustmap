/**
 * Path rules for the report contract: always POSIX and relative to the scanned repo root.
 * Absolute paths and Windows separators are rejected so agents never get host-local strings.
 */
import { z } from "zod";

const ABSOLUTE_OR_WINDOWS =
  /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/;

/** Relative POSIX path (no `\`, no drive letter, no leading `/`). */
export const RepoRelativePath = z
  .string()
  .min(1)
  .refine((p) => !p.includes("\\"), {
    message: "path must be POSIX (no backslash)",
  })
  .refine((p) => !ABSOLUTE_OR_WINDOWS.test(p), {
    message: "path must be relative to the scanned repo root",
  })
  .refine((p) => !p.includes("\0"), {
    message: "path must not contain null bytes",
  });

export type RepoRelativePath = z.infer<typeof RepoRelativePath>;
