/** 최신 마켓 리포트 (추천 시점 대비 변동률 포함) */
export interface MarketReportWithChange {
  id: string;
  seq: number;
  symbol: string;
  weight: number;
  reason: string;
  confidence: number;
  batchId: string;
  createdAt: string;
  updatedAt: string;
  recommendationPrice?: number;
  currentPrice?: number;
  priceChangePct?: number;
}

/** 보유 종목 (History 기반, 당일 변동량 포함) */
export interface HoldingWithDailyChange {
  symbol: string;
  category?: string;
  currentPrice?: number;
  dailyChangePct?: number;
  dailyChangeAbs?: number;
}

/** 알림 로그 한 건 */
export interface NotifyLogItem {
  id: string;
  message: string;
  createdAt: string;
  updatedAt: string;
}
