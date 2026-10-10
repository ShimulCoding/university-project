/** Positive slices retain their source index; zero values never claim chart area. */
export function pieSlices(amounts: string[]) {
  const positive = amounts.map((amount, index) => ({ value: Number(amount), index }))
    .filter(({ value }) => Number.isFinite(value) && value > 0);
  const sum = positive.reduce((total, item) => total + item.value, 0);
  if (!Number.isFinite(sum) || sum <= 0) return [];
  let startAngle = 0;
  return positive.map(({ value, index }, sliceIndex) => {
    const endAngle = sliceIndex === positive.length - 1 ? 360 : startAngle + (value / sum) * 360;
    const slice = { index, startAngle, endAngle };
    startAngle = endAngle;
    return slice;
  });
}
