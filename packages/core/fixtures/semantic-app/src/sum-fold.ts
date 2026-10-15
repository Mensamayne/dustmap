export function foldSum(list: number[]): number {
  let result = 0;
  for (const item of list) {
    if (item > 0) {
      result += item;
    } else {
      result -= 1;
    }
  }
  return result + list.length;
}
