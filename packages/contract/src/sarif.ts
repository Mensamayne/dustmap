/**
 * Map a Dustmap report to SARIF 2.1.0. Rule id = finding kind; result level from confidence.
 * Does not invent findings — only projects the contract into the OASIS log shape.
 */
import type { Confidence, Finding, FindingKind } from "./finding.js";
import type { Report } from "./report.js";

export type SarifLevel = "error" | "warning" | "note" | "none";

export const SARIF_SCHEMA_URI =
  "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json" as const;

export type SarifLog = {
  $schema: typeof SARIF_SCHEMA_URI;
  version: "2.1.0";
  runs: Array<{
    tool: {
      driver: {
        name: string;
        informationUri?: string;
        rules: Array<{
          id: string;
          name: string;
          shortDescription: { text: string };
          helpUri?: string;
        }>;
      };
    };
    results: Array<{
      ruleId: string;
      level: SarifLevel;
      message: { text: string };
      fingerprints?: { dustmapFingerprint: string };
      locations: Array<{
        physicalLocation: {
          artifactLocation: { uri: string };
          region?: { startLine: number; endLine?: number };
        };
      }>;
    }>;
    invocations?: Array<{
      executionSuccessful: boolean;
      workingDirectory?: { uri: string };
    }>;
  }>;
};

const DRIVER_NAME = "dustmap";

export function confidenceToSarifLevel(confidence: Confidence): SarifLevel {
  switch (confidence) {
    case "high":
      return "error";
    case "medium":
      return "warning";
    case "low":
      return "note";
  }
}

function ruleShortDescription(kind: FindingKind): string {
  return `Dustmap finding kind: ${kind}`;
}

function resultMessage(finding: Finding): string {
  const evidence =
    finding.evidence.length > 0
      ? finding.evidence.map((e) => `${e.label}: ${e.value}`).join("; ")
      : finding.verifyHint;
  return `[${finding.category}] ${finding.kind} — ${evidence}`;
}

export function toSarif(report: Report): SarifLog {
  const kinds = [...new Set(report.findings.map((f) => f.kind))].sort();
  const rules = kinds.map((id) => ({
    id,
    name: id,
    shortDescription: { text: ruleShortDescription(id) },
  }));

  const results = report.findings.map((finding) => {
    const locations = finding.locations.map((loc) => {
      const region =
        loc.startLine !== undefined
          ? {
              startLine: loc.startLine,
              ...(loc.endLine !== undefined ? { endLine: loc.endLine } : {}),
            }
          : undefined;
      return {
        physicalLocation: {
          artifactLocation: { uri: loc.path },
          ...(region ? { region } : {}),
        },
      };
    });

    return {
      ruleId: finding.kind,
      level: confidenceToSarifLevel(finding.confidence),
      message: { text: resultMessage(finding) },
      fingerprints: { dustmapFingerprint: finding.fingerprint },
      locations,
    };
  });

  return {
    $schema: SARIF_SCHEMA_URI,
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: DRIVER_NAME,
            informationUri: "https://github.com/Mensamayne/dustmap",
            rules,
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
          },
        ],
      },
    ],
  };
}
