export function totalOf(values: number[]): number {
  let sum = 0;
  for (const value of values) {
    if (value > 0) {
      sum += value;
    } else {
      sum -= 1;
    }
  }
  return sum + values.length;
}
