/** Fixture with known cyclomatic complexity: 1 base + 4 if/else-if decisions = 5. */
export function grade(score: number): string {
  if (score >= 90) {
    return "A";
  } else if (score >= 80) {
    return "B";
  } else if (score >= 70) {
    return "C";
  } else if (score >= 60) {
    return "D";
  } else {
    return "F";
  }
}

/** Many boolean flags — booleanParamCount = 3. */
export function applyFlags(
  a: boolean,
  b: boolean,
  c: boolean,
  name: string,
): string {
  if (a && b) return name;
  if (c) return name + "!";
  return name;
}

/** Long parameter list — 7 params. */
export function wide(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number,
): number {
  return a + b + c + d + e + f + g;
}
