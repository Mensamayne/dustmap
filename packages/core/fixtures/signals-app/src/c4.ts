export function route(entity: { kind: string }): void {
  if (entity.kind === "sorbet") {
    return;
  }
}
