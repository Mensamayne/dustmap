export function accumulate(nums: number[]): number {
  let acc = 0;
  for (const n of nums) {
    if (n > 0) {
      acc = acc + n;
    } else {
      acc = acc - 1;
    }
  }
  return acc + nums.length;
}
