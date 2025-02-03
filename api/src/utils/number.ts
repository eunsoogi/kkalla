export const formatNumber = (digit: number): string => {
  return digit.toLocaleString(undefined, { maximumFractionDigits: 0 });
};
