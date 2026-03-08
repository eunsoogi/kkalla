import type { MinuteLookupCandidate, MinuteLookupMode } from '@/utils/price.types';

import { SortDirection } from '../item/item.enum';
import { MarketRegimeSnapshot } from '../market-regime/market-regime.types';
import type { KrwTickerDailyData } from '../upbit/upbit.types';

export interface MarketSignalFilter {
  symbol?: string;
  startDate?: Date;
  endDate?: Date;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  sortDirection?: SortDirection;
}

export type MarketSignalRegime = 'risk_on' | 'neutral' | 'risk_off';
export type MarketSignalRegimeSource = 'live' | 'cache_fallback' | 'unavailable_risk_off';
export type SignalPriceSource = 'minute' | 'fallback' | 'none';
export type { MinuteLookupCandidate, MinuteLookupMode };

export interface MarketSignal {
  symbol: string;
  reason: string;
  confidence: number;
  weight: number;
  cashWeight?: number;
  regime?: MarketSignalRegime;
  riskFlags?: string[];
}

export interface MarketSignalInferenceItem {
  symbol: string;
  weight: number;
  confidence: number;
  cashWeight: number;
  regime: MarketSignalRegime;
  riskFlags: string[];
  reason: string;
}

export interface MarketSignalResponse {
  batchId: string;
  recommendations: MarketSignal[];
}

export interface MarketSignalData {
  id?: string;
  batchId: string;
  symbol: string;
  weight: number;
  reason: string;
  confidence: number;
  recommendationPrice?: number | null;
  cashWeight?: number;
  regime?: MarketSignalRegime;
  riskFlags?: string[];
  btcDominance?: number | null;
  altcoinIndex?: number | null;
  marketRegimeAsOf?: Date | null;
  marketRegimeSource?: MarketSignalRegimeSource | null;
  marketRegimeIsStale?: boolean | null;
  feargreedIndex?: number | null;
  feargreedClassification?: string | null;
  feargreedTimestamp?: Date | null;
}

export const MARKET_SIGNAL_STATE_CACHE_KEY = 'market-intelligence:latest-state';
export const MARKET_SIGNAL_STATE_CACHE_TTL_SECONDS = 60 * 60 * 48; // 48h
export const MARKET_SIGNAL_STATE_MAX_AGE_MS = MARKET_SIGNAL_STATE_CACHE_TTL_SECONDS * 1000;

export interface MarketSignalState {
  batchId: string;
  hasRecommendations: boolean;
  updatedAt: number;
}

export interface LatestPriceChangeOptions {
  mode?: MinuteLookupMode;
}

export interface SaveMarketSignalOptions {
  recommendationTime?: Date;
  marketData?: KrwTickerDailyData | null;
  marketRegime?: MarketRegimeSnapshot | null;
  feargreed?: MarketRegimeSnapshot['feargreed'];
}

export interface SignalPriceResolution {
  price?: number;
  source: SignalPriceSource;
}
