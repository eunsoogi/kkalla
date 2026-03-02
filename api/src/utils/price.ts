import type { MinuteLookupCandidate, MinuteLookupMode } from './price.types';

/**
 * 분봉 조회 대상 후보 집합을 구성합니다.
 * @param items 후보 항목
 * @param mode 조회 모드
 * @returns 조회 대상 id 집합
 */
export const buildMinuteLookupCandidateSet = (items: MinuteLookupCandidate[], mode: MinuteLookupMode): Set<string> => {
  if (mode === 'exact') {
    return new Set(items.map((item) => item.id));
  }

  if (mode !== 'mixed') {
    return new Set();
  }

  const now = Date.now();
  return new Set(
    items
      .filter((item) => now - new Date(item.createdAt).getTime() <= 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3)
      .map((item) => item.id),
  );
};

/**
 * 일봉 데이터를 사용해 추천 시점 근사 가격을 계산합니다.
 * @param candles1d 일봉 데이터
 * @param createdAt 추천 시점
 * @param currentPrice 현재가 fallback
 * @returns 근사 가격 또는 undefined
 */
export const resolveDailyFallbackPrice = (
  candles1d: number[][],
  createdAt: Date,
  currentPrice?: number,
): number | undefined => {
  if (candles1d.length < 1) {
    return currentPrice;
  }

  const recDateStr = new Date(createdAt).toISOString().slice(0, 10);
  const candleSameDay = candles1d.find((candle) => new Date(candle[0]).toISOString().slice(0, 10) === recDateStr);

  if (candleSameDay && candleSameDay.length >= 5) {
    return Number(candleSameDay[4]);
  }

  const lastCandle = candles1d[candles1d.length - 1];
  if (lastCandle && lastCandle.length >= 5) {
    return Number(lastCandle[4]);
  }

  return currentPrice;
};
