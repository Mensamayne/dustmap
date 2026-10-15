/**
 * Scan inventory — which files a scan covers (full or diff) and what each one is (role + reason).
 * Shared by runScan and by tooling that needs the file picture without running detectors
 * (target runs, a future `dustmap files` command). Reads file text once; oversized files never.
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { FileRole, type FileRoleType } from "@dustmap/contract";
import type { DustmapConfig } from "../config/schema.js";
import type { ScanMode } from "../adapter.js";
import { classifyFile, linguistAttributes, pathClassifier } from "./classify.js";
import { collectFiles, filterExisting } from "./collect-files.js";
import { gitDiffNameOnly } from "./git.js";
import { expandImportNeighbors } from "./import-neighbors.js";

export type ClassifiedFiles = {
  /** Text of every file that was read (all but `oversized`). */
  contents: Map<string, string>;
  /** Cache key material per file: its text, or size+mtime for files never read. */
  cacheKeys: Map<string, string>;
  roles: Map<string, FileRoleType>;
  reasons: Map<string, string>;
  byRole: Record<FileRoleType, number>;
};

export type Inventory = ClassifiedFiles & { files: string[] };

/** Files a scan covers: the whole include set, or changed files plus their import neighbours. */
export function selectFiles(repoRoot: string, config: DustmapConfig, mode: ScanMode, baseRef?: string): string[] {
  if (mode === "full") return collectFiles(repoRoot, config);
  if (!baseRef) throw new Error("diff mode requires baseRef");
  const changed = filterExisting(repoRoot, gitDiffNameOnly(repoRoot, baseRef), config);
  return filterExisting(repoRoot, expandImportNeighbors(repoRoot, changed), config);
}

export function classifyFiles(repoRoot: string, files: readonly string[], config: DustmapConfig): ClassifiedFiles {
  const contents = new Map<string, string>();
  const cacheKeys = new Map<string, string>();
  const roles = new Map<string, FileRoleType>();
  const reasons = new Map<string, string>();
  const byRole = Object.fromEntries(FileRole.options.map((r) => [r, 0])) as Record<FileRoleType, number>;
  const attrs = linguistAttributes(repoRoot, files);
  const byPath = pathClassifier(config.classify);

  for (const f of files) {
    const abs = path.join(repoRoot, f);
    const st = statSync(abs);
    let text: string | undefined;
    const readText = () => (text ??= readFileSync(abs, "utf8"));
    const { role, reason } = classifyFile(f, st.size, readText, config.classify, attrs, byPath);
    if (role !== "oversized") readText();
    if (text !== undefined) contents.set(f, text);
    cacheKeys.set(f, text ?? `\0unread size=${st.size} mtime=${st.mtimeMs}`);
    roles.set(f, role);
    reasons.set(f, reason);
    byRole[role] += 1;
  }
  return { contents, cacheKeys, roles, reasons, byRole };
}

export function takeInventory(
  repoRoot: string,
  config: DustmapConfig,
  mode: ScanMode = "full",
  baseRef?: string,
): Inventory {
  const files = selectFiles(repoRoot, config, mode, baseRef);
  return { files, ...classifyFiles(repoRoot, files, config) };
}
