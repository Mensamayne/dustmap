/**
 * jscpd JSON reporter shapes we consume. Local types keep core free of jscpd internals.
 */

export type JscpdFileRef = {
  name: string;
  start: number;
  end: number;
  startLoc?: { line: number; column: number; position: number };
  endLoc?: { line: number; column: number; position: number };
};

export type JscpdDuplicate = {
  format?: string;
  fragment?: string;
  lines?: number;
  tokens?: number;
  kind?: string;
  firstFile: JscpdFileRef;
  secondFile: JscpdFileRef;
};

export type JscpdJsonReport = {
  duplicates: JscpdDuplicate[];
  statistics?: unknown;
};
