/**
 * Source text of a top-level declaration by exported name, read from the TypeScript AST. Dead-code
 * fingerprints hash this text (BUG-08), so editing the symbol yields a new fingerprint while moving
 * it around the file does not. Re-exports without a local body return null.
 */
import ts from "typescript";

function scriptKind(fileName: string): ts.ScriptKind {
  if (/\.tsx$/.test(fileName)) return ts.ScriptKind.TSX;
  if (/\.jsx$/.test(fileName)) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function hasDefaultModifier(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
}

type Named = { name?: ts.Node };

function declaredName(node: ts.Statement): string | undefined {
  const n = (node as Named).name;
  return n && ts.isIdentifier(n) ? n.text : undefined;
}

/**
 * Text of every top-level declaration of `name` (overloads and declaration merging give several),
 * or of the default export when `name` is "default". null when the file declares no such body.
 */
export function declarationText(fileName: string, text: string, name: string): string | null {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false, scriptKind(fileName));
  const parts: string[] = [];
  for (const stmt of sf.statements) {
    if (name === "default") {
      if (ts.isExportAssignment(stmt) || hasDefaultModifier(stmt)) parts.push(stmt.getText(sf));
      continue;
    }
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && decl.name.text === name) parts.push(decl.getText(sf));
      }
      continue;
    }
    if (declaredName(stmt) === name) parts.push(stmt.getText(sf));
  }
  return parts.length > 0 ? parts.join("\n") : null;
}
