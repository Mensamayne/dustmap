/**
 * Render a queue brief markdown from a Dustmap finding.
 * Uses an optional on-disk template with placeholders, else a built-in shape
 * compatible with this repo's briefs/_TEMPLATE.md sections.
 */
import { readFileSync, existsSync } from "node:fs";
import type { FindingType } from "@dustmap/contract";

export type BriefRenderInput = {
  id: string;
  title: string;
  epic: string;
  segment: string;
  layer: number;
  finding: FindingType;
  /** Absolute path to a template file; when missing, use built-in. */
  templatePath?: string;
};

const BUILTIN_TEMPLATE = `# {{ID}} — {{title}}

**Queue:** \`{{ID}}\` | **Epic:** {{epic}} | **Segment:** {{segment}} | **Layer:** {{layer}}

## Overview

{{overview}}

## Plan

### Step 1 — Review the Dustmap finding

- **Plik:** (see Pliki)
- **Zmiana:** Address the signal with evidence below. Do not delete code until verifyHint passes.
- **Done when:** Finding gone from a fresh scan, or recorded as keep/wontfix in Dustmap.

## Constraints

- Never change scanned-repo sources from Dustmap itself (report-only)
- Run verifyHint before destructive edits
- Do not overwrite unrelated briefs

## Pliki (scope)

{{scope_files}}

## Weryfikacja

{{verify_section}}

\`\`\`bash
npm run verify
\`\`\`

## Fingerprint

\`dustmap:{{fingerprint}}\`
`;

function overviewFor(finding: FindingType): string {
  const loc = finding.locations[0];
  const where = loc
    ? `${loc.path}${loc.symbol ? ` (${loc.symbol})` : ""}`
    : "unknown location";
  const evidence =
    finding.evidence.length > 0
      ? finding.evidence.map((e) => `${e.label}: ${e.value}`).join("; ")
      : "no extra evidence";
  return (
    `Dustmap flagged **${finding.kind}** (${finding.category}, confidence ${finding.confidence}) at \`${where}\`. ` +
    `Source detector: ${finding.source}. Suggested action: ${finding.suggestedAction}. ` +
    `Evidence: ${evidence}.`
  );
}

function scopeFiles(finding: FindingType): string {
  const paths = [...new Set(finding.locations.map((l) => l.path))];
  if (paths.length === 0) return "- _(no locations)_";
  return paths.map((p) => `- \`${p}\``).join("\n");
}

function verifySection(finding: FindingType): string {
  return (
    `${finding.verifyHint}\n\n` +
    `Also re-scan after the change: \`dustmap scan\` then \`dustmap show ${finding.fingerprint}\`.`
  );
}

function applyPlaceholders(template: string, map: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(map)) {
    out = out.split(`{{${key}}}`).join(value);
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

export function renderBrief(input: BriefRenderInput): string {
  let template = BUILTIN_TEMPLATE;
  if (input.templatePath && existsSync(input.templatePath)) {
    template = readFileSync(input.templatePath, "utf8");
  }

  const title = input.title;
  const map: Record<string, string> = {
    ID: input.id,
    id: input.id,
    title,
    tytuł: title,
    epic: input.epic,
    EPIC: input.epic,
    segment: input.segment,
    layer: String(input.layer),
    N: String(input.layer),
    overview: overviewFor(input.finding),
    scope_files: scopeFiles(input.finding),
    verify_section: verifySection(input.finding),
    verifyHint: input.finding.verifyHint,
    fingerprint: input.finding.fingerprint,
  };

  return applyPlaceholders(template, map);
}

export function titleForFinding(finding: FindingType): string {
  const loc = finding.locations[0];
  const tip = loc?.symbol ?? loc?.path ?? finding.kind;
  return `${finding.kind}: ${tip}`;
}
