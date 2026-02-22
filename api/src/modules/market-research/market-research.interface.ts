import { SortDirection } from '../item/item.enum';

export interface MarketRecommendationFilter {
  symbol?: string;
  startDate?: Date;
  endDate?: Date;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  sortDirection?: SortDirection;
}

export interface MarketRecommendation {
  symbol: string;
  reason: string;
  confidence: number;
  weight: number;
  cashWeight?: number;
  regime?: 'risk_on' | 'neutral' | 'risk_off';
  riskFlags?: string[];
}

export interface MarketRecommendationResponse {
  batchId: string;
  recommendations: MarketRecommendation[];
}

export interface MarketRecommendationData {
  id?: string;
  batchId: string;
  symbol: string;
  weight: number;
  reason: string;
  confidence: number;
  recommendationPrice?: number | null;
  cashWeight?: number;
  regime?: 'risk_on' | 'neutral' | 'risk_off';
  riskFlags?: string[];
}

export const MARKET_RECOMMENDATION_STATE_CACHE_KEY = 'market-research:latest-state';
export const MARKET_RECOMMENDATION_STATE_CACHE_TTL_SECONDS = 60 * 60 * 48; // 48h
export const MARKET_RECOMMENDATION_STATE_MAX_AGE_MS = MARKET_RECOMMENDATION_STATE_CACHE_TTL_SECONDS * 1000;

export interface MarketRecommendationState {
  batchId: string;
  hasRecommendations: boolean;
  updatedAt: number;
}
