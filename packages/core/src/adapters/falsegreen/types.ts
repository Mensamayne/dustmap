/**
 * Raw falsegreen-js JSON report shapes — adapter-internal only; never leak into the contract.
 */

export type FalsegreenConfidence = "high" | "low";

export type FalsegreenFinding = {
  file: string;
  line: number;
  code: string;
  detail: string;
  confidence: FalsegreenConfidence;
  title: string;
  level: string;
  snippet?: string;
  riskGroup?: string;
  group?: string;
  fix?: string;
};

export type FalsegreenJsonReport = {
  tool?: string;
  version?: string;
  findings: FalsegreenFinding[];
};
