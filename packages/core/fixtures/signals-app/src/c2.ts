export function check(item: { kind: string }): boolean {
  return item.kind === "sorbet";
}
