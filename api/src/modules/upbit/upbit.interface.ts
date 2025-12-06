import { Balances } from 'ccxt';

import { OrderTypes } from './upbit.enum';

export interface UpbitConfigData {
  accessKey: string;
  secretKey: string;
}

export interface OrderRequest {
  symbol: string;
  type: OrderTypes;
  amount: number;
}

export interface AdjustOrderRequest {
  symbol: string;
  diff: number;
  balances: Balances;
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
}

export interface KrwMarketData {
  symbol: string;
  ticker: any;
  candles1h: any[]; // 1시간봉
  candles4h: any[]; // 4시간봉
  candles1d: any[]; // 일봉
  candles1w?: any[]; // 주봉
}
