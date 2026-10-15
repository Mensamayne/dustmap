export function matchKind(row: { kind: string }): string {
  if (row.kind === "sorbet") return "cold";
  return "other";
}
