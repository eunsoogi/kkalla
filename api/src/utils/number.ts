export const formatNumber = (digit: number) => {
  return digit.toLocaleString(undefined, { maximumFractionDigits: 0 });
};
