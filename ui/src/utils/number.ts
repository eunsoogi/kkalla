export const formatNumber = (digit: number) => {
  return digit.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

/**
 * 가격 표시 공통 포맷:
 * - 10 미만이면 소수점 최대 4자리
 * - 2자리 수(10 이상 100 미만)이면 소수점 최대 2자리
 * - 그 외에는 정수
 */
export const formatPrice = (price: number): string => {
  if (price < 10) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  }
  if (price >= 10 && price < 100) {
    return price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  return formatNumber(price);
};
