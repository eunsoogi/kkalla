export const formatNumber = (digit: number) => {
  return digit.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

/**
 * 마켓 리포트 등 가격 표시: 10 미만이면 소수점 최대 4자리, 이상이면 정수
 */
export const formatPriceForReport = (price: number): string => {
  if (price < 10) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  }
  return formatNumber(price);
};
