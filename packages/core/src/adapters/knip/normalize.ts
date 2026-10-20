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
import { declarationText } from "./declaration-text.js";
import { countNameMentions, countScriptMentions, fileStem } from "./name-mentions.js";
import type { KnipJsonFileIssues, KnipJsonIssueItem, KnipJsonReport } from "./types.js";

const SOURCE = "knip";
const VERIFY_HINT =
  "Remove or wire the symbol, then run the package typecheck and its tests.";

/**
 * Roles never reported as dead code: machine-made or foreign files, and `fixture` — test data read
 * from disk by tests, which nothing imports by design (BUG-06).
 */
const BLOCKED_ROLES = new Set(["generated", "vendored", "minified", "oversized", "fixture"]);

export type NormalizeKnipOptions = {
  /** Repo-relative POSIX paths Knip reported; used to drop findings outside the scan inventory. */
  scannedFiles: ReadonlySet<string>;
  roles: ReadonlyMap<string, string>;
  /**
   * Text of readable files (source + test + fixture): hashed into fingerprints (BUG-08) and searched
   * for string-literal name mentions.
   */
  fileTexts: ReadonlyMap<string, string>;
  /**
   * Facts about the package.json that declares a dependency: are its dependencies installed, and the
   * text of its scripts (a dependency may be used only as a command there).
   */
  dependencyFacts: (packageJsonPath: string) => DependencyFacts;
};

export type DependencyFacts = { installed: boolean; scripts: string };

const DEPENDENCY_KINDS = new Set<FindingKind>(["unused-dependency", "unlisted-dependency"]);

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
  // Root and workspace manifests carry dependency findings (workspace ones exist since BUG-12).
  if (path === "package.json" || path.endsWith("/package.json")) return !path.includes("node_modules/");
  if (!opts.scannedFiles.has(path)) return false;
  const role = opts.roles.get(path);
  if (role && BLOCKED_ROLES.has(role)) return false;
  return true;
}

/**
 * What the fingerprint hashes (BUG-08): the code itself, so an edit brings a muted finding back and a
 * move does not. Files → whole text; exports / types → their declaration; dependencies have no code.
 * Only a re-export without a local body (or an unreadable file) falls back to the name.
 */
function codeSnippet(kind: FindingKind, path: string, name: string, opts: NormalizeKnipOptions): string {
  if (kind === "unused-dependency" || kind === "unlisted-dependency") return `dep:${name}`;
  const text = opts.fileTexts.get(path);
  if (kind === "unused-file") return text ?? `file:${path}`;
  return (text === undefined ? null : declarationText(path, text, name)) ?? `export ${name}`;
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
  const mentions = countNameMentions(mentionNeedle, opts.fileTexts.values());
  const isDependency = DEPENDENCY_KINDS.has(kind);
  const facts = isDependency ? opts.dependencyFacts(path) : null;
  const inScripts = facts ? countScriptMentions(item.name, facts.scripts) : 0;
  // Without installed dependencies Knip cannot resolve commands in scripts or config-loading plugins,
  // so a dependency verdict is a guess at best (BUG-10).
  const confidence: Confidence =
    facts && (!facts.installed || inScripts > 0) ? "low" : confidenceForMentions(mentions);

  // A dependency has no code; its manifest path keeps two packages' findings apart.
  const symbols = isDependency ? [item.name, path] : [symbolFromName ? item.name : path];
  const fp = fingerprint(kind, [codeSnippet(kind, path, item.name, opts)], symbols);

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
      ...(facts
        ? [
            { label: "script-mentions", value: String(inScripts) },
            ...(facts.installed
              ? []
              : [{ label: "dependencies-installed", value: "no — scripts and plugin configs could not be checked" }]),
          ]
        : []),
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
