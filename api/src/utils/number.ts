export const formatNumber = (digit: number): string => {
  return digit.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

/**
 * 정수 부분은 그대로 두고, 소수점 부분만 지정된 유효숫자로 제한
 * @param num 포맷팅할 숫자
 * @param precision 소수점 부분의 유효숫자 자릿수 (기본값: 3)
 */
export const formatDecimalPlaces = (num: number, precision: number = 3): number => {
  if (num === 0 || !isFinite(num) || isNaN(num)) {
    return num;
  }

  // 정수는 그대로 반환
  if (Number.isInteger(num)) {
    return num;
  }

  // 정수 부분과 소수 부분 분리
  const integerPart = Math.trunc(num);
  const decimalPart = num - integerPart;

  // 소수 부분이 0이면 정수 그대로 반환
  if (decimalPart === 0) {
    return integerPart;
  }

  // 소수 부분만 유효숫자 제한 적용
  const formattedDecimal = parseFloat(decimalPart.toPrecision(precision));

  return integerPart + formattedDecimal;
};

/**
 * 객체의 모든 숫자 값을 재귀적으로 포맷팅
 * @param obj 포맷팅할 객체
 * @param precision 소수점 부분의 유효숫자 자릿수 (기본값: 3)
 */
export const formatObjectNumbers = (obj: any, precision: number = 3): any => {
  if (typeof obj === 'number') {
    return formatDecimalPlaces(obj, precision);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => formatObjectNumbers(item, precision));
  }

  if (obj !== null && typeof obj === 'object') {
    const formatted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      formatted[key] = formatObjectNumbers(value, precision);
    }
    return formatted;
  }

  return obj;
};
