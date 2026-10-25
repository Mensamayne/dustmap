/**
 * Which language family a scanned file belongs to. Script detectors (knip, jscpd, code signals,
 * dependency graph, semantic) see only script files; stylesheets go to the CSS duplicate layer
 * (DUP-01) through `styleFilesWithRole`.
 */
const STYLE_FILE = /\.(?:css|scss)$/i;

export function isStyleFile(path: string): boolean {
  return STYLE_FILE.test(path);
}
