export function computeScore(items: number[]): number {
  let total = 0;
  for (const item of items) {
    if (item > 0) {
      total += item * 2;
    } else {
      total -= 1;
    }
  }
  return total + items.length;
}

export const labelA = "a";
