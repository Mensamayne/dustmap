/**
 * Human-oriented markdown export — top places plus findings grouped by category with evidence.
 */
import type { FindingType, ReportType } from "@dustmap/contract";

function evidenceLine(f: FindingType): string {
  if (f.evidence.length === 0) return f.verifyHint;
  return f.evidence.map((e) => `${e.label}: ${e.value}`).join("; ");
}

export function reportToMarkdown(report: ReportType): string {
  const lines: string[] = [];
  lines.push("# Dustmap report");
  lines.push("");
  lines.push(
    `Scan: **${report.scan.mode}** · commit \`${report.scan.commit}\` · ${report.scan.startedAt}`,
  );
  lines.push("");
  lines.push("## Summary by category");
  lines.push("");
  for (const [cat, n] of Object.entries(report.summary.byCategory)) {
    if (n > 0) lines.push(`- **${cat}**: ${n}`);
  }
  lines.push("");
  lines.push("## Top places");
  lines.push("");
  if (report.summary.topPlaces.length === 0) {
    lines.push("_No ranked places._");
  } else {
    for (const [i, p] of report.summary.topPlaces.entries()) {
      lines.push(
        `${i + 1}. \`${p.path}\` — score ${p.score.toFixed(1)} (${p.findingFingerprints.length} signals)`,
      );
    }
  }
  lines.push("");
  lines.push("## Findings by category");
  lines.push("");

  const byCat = new Map<string, FindingType[]>();
  for (const f of report.findings) {
    const list = byCat.get(f.category) ?? [];
    list.push(f);
    byCat.set(f.category, list);
  }
  const cats = [...byCat.keys()].sort();
  for (const cat of cats) {
    lines.push(`### ${cat}`);
    lines.push("");
    for (const f of byCat.get(cat) ?? []) {
      const locs = f.locations
        .map((l) => {
          const range =
            l.startLine !== undefined
              ? `:${l.startLine}${l.endLine !== undefined ? `-${l.endLine}` : ""}`
              : "";
          return `\`${l.path}${range}\``;
        })
        .join(", ");
      lines.push(
        `- **${f.kind}** (\`${f.fingerprint}\`, ${f.confidence}) — ${locs}`,
      );
      lines.push(`  - ${evidenceLine(f)}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("_Dustmap is report-only: it never edits your source._");
  lines.push("");
  return lines.join("\n");
}
