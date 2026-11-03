/** Bar heights as percentages (0 to 100) of the largest count. All zeros gives all zeros. */
export function barPercents(counts: number[]): number[] {
  const max = Math.max(0, ...counts);
  return counts.map((c) => (max === 0 ? 0 : (c / max) * 100));
}
