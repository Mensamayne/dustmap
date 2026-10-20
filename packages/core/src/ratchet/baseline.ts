/**
 * Baseline fingerprint set under outputDir/baseline.json. Updated only via explicit updateBaseline.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { UserInputError } from "../user-input-error.js";

export const BASELINE_FILE = "baseline.json";
export const BASELINE_SCHEMA_ID = "dustmap.baseline/v1" as const;

export const BaselineFile = z
  .object({
    schema: z.literal(BASELINE_SCHEMA_ID),
    fingerprints: z.array(z.string().regex(/^[a-f0-9]{16}$/)),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type BaselineFile = z.infer<typeof BaselineFile>;

export function baselinePath(outputDir: string): string {
  return path.join(outputDir, BASELINE_FILE);
}

export function loadBaseline(outputDir: string): BaselineFile {
  const file = baselinePath(outputDir);
  if (!existsSync(file)) {
    return {
      schema: BASELINE_SCHEMA_ID,
      fingerprints: [],
      updatedAt: new Date(0).toISOString(),
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new UserInputError(`Invalid baseline.json (${file}): ${String(err)}`);
  }
  const result = BaselineFile.safeParse(raw);
  if (!result.success) throw new UserInputError(`Invalid baseline.json (${file}): ${result.error.message}`);
  return result.data;
}

export function saveBaseline(outputDir: string, file: BaselineFile): string {
  mkdirSync(outputDir, { recursive: true });
  const validated = BaselineFile.parse(file);
  const dest = baselinePath(outputDir);
  writeFileSync(dest, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  return dest;
}
