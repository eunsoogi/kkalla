export interface SymbolVolatility {
  /**
   * 이번 1분봉 포함 10분 윈도우에서 새로운 변동 구간(버킷)에 진입했는지 여부
   */
  triggered: boolean;

  /**
   * 이전 10분 변동폭 비율 (0~1)
   */
  prevPercent: number;

  /**
   * 현재 10분 변동폭 비율 (0~1)
   */
  currPercent: number;

  /**
   * 이전 10분 변동 버킷 기준값 비율 (0, 0.05, 0.10, ...)
   */
  prevBucket: number;

  /**
   * 현재 10분 변동 버킷 기준값 비율 (0, 0.05, 0.10, ...)
   */
  currBucket: number;
}
