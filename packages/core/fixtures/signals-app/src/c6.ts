export function filterSorbet(list: Array<{ kind: string }>): Array<{ kind: string }> {
  return list.filter((x) => x.kind === "sorbet");
}
