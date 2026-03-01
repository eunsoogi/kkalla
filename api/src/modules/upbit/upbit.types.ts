import { Balances, Order } from 'ccxt';

import { OrderTypes } from './upbit.enum';

export type OrderExecutionUrgency = 'urgent' | 'normal';
export type OrderExecutionMode = 'market' | 'limit_ioc' | 'limit_post_only';

export interface UpbitOrderCostEstimate {
  feeRate: number;
  spreadRate: number;
  impactRate: number;
  estimatedCostRate: number;
}

export interface UpbitConfigData {
  accessKey: string;
  secretKey: string;
}

export interface OrderRequest {
  symbol: string;
  type: OrderTypes;
  amount: number;
  executionMode?: OrderExecutionMode;
  limitPrice?: number;
  timeInForce?: 'ioc' | 'fok' | 'po';
  costEstimate?: UpbitOrderCostEstimate | null;
  expectedEdgeRate?: number | null;
  gateBypassedReason?: string | null;
  triggerReason?: string | null;
}

export interface AdjustOrderRequest {
  symbol: string;
  diff: number;
  balances: Balances;
  marketPrice?: number;
  executionUrgency?: OrderExecutionUrgency;
  costEstimate?: UpbitOrderCostEstimate | null;
  expectedEdgeRate?: number | null;
  gateBypassedReason?: string | null;
  triggerReason?: string | null;
}

export interface AdjustedOrderResult {
  order: Order | null;
  executionMode: OrderExecutionMode;
  orderType: 'market' | 'limit';
  timeInForce: string | null;
  requestPrice: number | null;
  requestedAmount: number | null;
  requestedVolume: number | null;
  filledAmount: number | null;
  filledRatio: number | null;
  averagePrice: number | null;
  orderStatus: string | null;
  expectedEdgeRate: number | null;
  estimatedCostRate: number | null;
  spreadRate: number | null;
  impactRate: number | null;
  gateBypassedReason: string | null;
  triggerReason: string | null;
}

export interface MarketFeatures {
  symbol: string;
  baseAsset: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  quoteVolume24h: number;
  marketCap?: number;

  // RSI 지표
  rsi14?: number;
  rsi9?: number;
  rsi21?: number;

  // MACD 지표
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };

  // 이동평균들
  sma?: {
    sma5: number;
    sma10: number;
    sma20: number;
    sma50: number;
    sma100: number;
    sma200: number;
  };
  ema?: {
    ema5: number;
    ema10: number;
    ema12: number;
    ema20: number;
    ema26: number;
    ema50: number;
    ema100: number;
    ema200: number;
  };

  // Bollinger Bands
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percentB: number;
  };

  // Stochastic Oscillator
  stochastic?: {
    percentK: number;
    percentD: number;
    slowK: number;
    slowD: number;
  };

  // Williams %R
  williamsR?: number;

  // ATR (Average True Range)
  atr?: {
    atr14: number;
    atr21: number;
    normalizedATR: number;
  };

  // VWAP (Volume Weighted Average Price)
  vwap?: number;

  // OBV (On Balance Volume)
  obv?: {
    current: number;
    trend: number; // OBV 기울기
    signal: 'bullish' | 'bearish' | 'neutral';
  };

  // CCI (Commodity Channel Index)
  cci?: number;

  // MFI (Money Flow Index)
  mfi?: number;

  // 추가 지표들
  volatility?: number;
  momentum?: number;
  liquidityScore?: number;
  pricePosition?: number; // 52주 고점 대비 현재 위치
  volumeRatio?: number; // 평균 대비 현재 거래량 비율

  // 지지/저항 레벨
  supportResistance?: {
    support1: number;
    support2: number;
    resistance1: number;
    resistance2: number;
  };

  // 패턴 인식
  patterns?: {
    trend: 'uptrend' | 'downtrend' | 'sideways';
    strength: number; // 추세 강도 (0-100)
    divergence: 'bullish' | 'bearish' | 'none';
  };

  // 예측 관련 지표들
  prediction?: {
    // 추세 지속성 점수 (0-100): 현재 추세가 지속될 가능성
    trendPersistence: number;
    // 가격 가속도: 가격 변화의 가속도 (양수=가속, 음수=감속)
    priceAcceleration: number;
    // 거래량 가속도: 거래량 변화의 가속도
    volumeAcceleration: number;
    // 예측 신뢰도 점수 (0-100): 여러 지표가 일치하는 정도
    confidence: number;
    // 가격 목표 레벨
    priceTargets?: {
      bullish: number; // 낙관적 목표가
      bearish: number; // 비관적 목표가
      neutral: number; // 중립 목표가
    };
    // 모멘텀 강도 (0-100): 현재 모멘텀의 강도
    momentumStrength: number;
  };

  // 이전 배치 intensity 변동성 지표 (5%p 차이 감지를 위해)
  intensityVolatility?: {
    // 최신 배치의 intensity 값
    latestIntensity: number;
    // intensity 변화 추세: 'increasing' | 'decreasing' | 'stable'
    intensityTrend: 'increasing' | 'decreasing' | 'stable';
    // intensity 변동 폭: 최근 배치들 중 최대 intensity와 최소 intensity의 차이
    intensityVolatility: number;
    // 최근 intensity 변화율: 최신 배치와 이전 배치 간 intensity 차이
    intensityChangeRate: number;
    // intensity 안정성 점수 (0-100): 낮을수록 변동이 큼, 높을수록 안정적
    intensityStability: number;
    // 최근 배치 수: 분석에 사용된 배치 수
    batchCount: number;
  };
}

export interface KrwMarketData {
  symbol: string;
  ticker: any;
  candles1h: any[]; // 1시간봉
  candles4h: any[]; // 4시간봉
  candles1d: any[]; // 일봉
  candles1w?: any[]; // 주봉
}

export interface KrwTickerDailyData {
  symbol: string;
  ticker: any;
  candles1d: any[];
}
