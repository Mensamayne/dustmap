/**
 * Map Knip JSON reporter output into Dustmap Finding records: dead-code kinds, content fingerprints,
 * name-mention evidence, and a non-destructive verify hint. Never suggests delete or --fix.
 */
import {
  fingerprint,
  type Confidence,
  type FindingKind,
  type FindingType,
} from "@dustmap/contract";
import { countNameMentions, fileStem } from "./name-mentions.js";
import type { KnipJsonFileIssues, KnipJsonIssueItem, KnipJsonReport } from "./types.js";

const SOURCE = "knip";
const VERIFY_HINT =
  "Remove or wire the symbol, then run the package typecheck and its tests.";

const BLOCKED_ROLES = new Set(["generated", "vendored", "minified", "oversized"]);

export type NormalizeKnipOptions = {
  /** Repo-relative POSIX paths Knip reported; used to drop findings outside the scan inventory. */
  scannedFiles: ReadonlySet<string>;
  roles: ReadonlyMap<string, string>;
  /** File texts used to count string-literal name mentions (source + test). */
  mentionTexts: readonly string[];
};

type KindSpec = {
  kind: FindingKind;
  items: KnipJsonIssueItem[] | undefined;
  /** When true, location.symbol is the item name; for unused-file the path is the subject. */
  symbolFromName: boolean;
};

function confidenceForMentions(mentions: number): Confidence {
  return mentions > 0 ? "low" : "high";
}

function toPosixPath(p: string): string {
  return p.replace(/\\/g, "/");
}

function isAllowedFile(path: string, opts: NormalizeKnipOptions): boolean {
  if (path === "package.json") return true;
  if (!opts.scannedFiles.has(path)) return false;
  const role = opts.roles.get(path);
  if (role && BLOCKED_ROLES.has(role)) return false;
  return true;
}

function buildFinding(
  kind: FindingKind,
  filePath: string,
  item: KnipJsonIssueItem,
  symbolFromName: boolean,
  opts: NormalizeKnipOptions,
): FindingType {
  const path = toPosixPath(filePath);
  const symbol = symbolFromName ? item.name : fileStem(path);
  const mentionNeedle = symbolFromName ? item.name : fileStem(path);
  const mentions = countNameMentions(mentionNeedle, opts.mentionTexts);
  const confidence = confidenceForMentions(mentions);

  const snippet =
    kind === "unused-file"
      ? `file:${path}`
      : kind === "unused-dependency" || kind === "unlisted-dependency"
        ? `dep:${item.name}`
        : `export ${item.name}`;

  const fp = fingerprint(kind, [snippet], [symbolFromName ? item.name : path]);

  const location: FindingType["locations"][number] = {
    path,
    ...(item.line !== undefined ? { startLine: item.line } : {}),
    ...(symbolFromName || kind === "unused-file" ? { symbol } : {}),
  };

  return {
    fingerprint: fp,
    kind,
    category: "dead-code",
    locations: [location],
    evidence: [
      { label: "knip", value: kind },
      {
        label: "name-mentions",
        value: String(mentions),
      },
    ],
    confidence,
    suggestedAction: confidence === "low" ? "review" : "verify",
    verifyHint: VERIFY_HINT,
    source: SOURCE,
  };
}

function specsForFile(row: KnipJsonFileIssues): KindSpec[] {
  return [
    { kind: "unused-file", items: row.files, symbolFromName: false },
    { kind: "unused-export", items: row.exports, symbolFromName: true },
    { kind: "unused-type", items: row.types, symbolFromName: true },
    { kind: "unused-dependency", items: row.dependencies, symbolFromName: true },
    { kind: "unused-dependency", items: row.devDependencies, symbolFromName: true },
    { kind: "unused-dependency", items: row.optionalPeerDependencies, symbolFromName: true },
    { kind: "unlisted-dependency", items: row.unlisted, symbolFromName: true },
  ];
}

/** Convert a Knip JSON report into Dustmap findings. */
export function normalizeKnipReport(
  report: KnipJsonReport,
  opts: NormalizeKnipOptions,
): FindingType[] {
  const out: FindingType[] = [];
  const seen = new Set<string>();

  for (const row of report.issues ?? []) {
    const filePath = toPosixPath(row.file);
    for (const spec of specsForFile(row)) {
      for (const item of spec.items ?? []) {
        const subjectPath =
          spec.kind === "unused-file" ? toPosixPath(item.name || filePath) : filePath;
        if (!isAllowedFile(subjectPath, opts)) continue;
        const finding = buildFinding(
          spec.kind,
          subjectPath,
          spec.kind === "unused-file" ? { ...item, name: item.name || subjectPath } : item,
          spec.symbolFromName,
          opts,
        );
        if (seen.has(finding.fingerprint)) continue;
        seen.add(finding.fingerprint);
        out.push(finding);
      }
    }
  }

  return out;
}
