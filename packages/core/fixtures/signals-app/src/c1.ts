export function pick(x: { kind: string }): boolean {
  return x.kind === "sorbet";
}
