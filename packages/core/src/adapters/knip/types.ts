/**
 * Knip `--reporter json` payload shapes we consume. Kept local so core does not depend on Knip's
 * internal TypeScript types; the adapter only reads what the JSON reporter prints.
 */

export type KnipJsonIssueItem = {
  name: string;
  line?: number;
  col?: number;
  pos?: number;
};

export type KnipJsonFileIssues = {
  file: string;
  files?: KnipJsonIssueItem[];
  exports?: KnipJsonIssueItem[];
  types?: KnipJsonIssueItem[];
  dependencies?: KnipJsonIssueItem[];
  devDependencies?: KnipJsonIssueItem[];
  optionalPeerDependencies?: KnipJsonIssueItem[];
  unlisted?: KnipJsonIssueItem[];
  binaries?: KnipJsonIssueItem[];
  unresolved?: KnipJsonIssueItem[];
  duplicates?: KnipJsonIssueItem[];
  enumMembers?: KnipJsonIssueItem[];
  namespaceMembers?: KnipJsonIssueItem[];
  catalog?: KnipJsonIssueItem[];
};

export type KnipJsonReport = {
  issues: KnipJsonFileIssues[];
};
