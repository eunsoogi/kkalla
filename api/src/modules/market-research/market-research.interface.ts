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
}

export interface MarketRecommendationResponse {
  batchId: string;
  recommendations: MarketRecommendation[];
}

export interface MarketRecommendationData {
  id: string;
  batchId: string;
  symbol: string;
  weight: number;
  reason: string;
  confidence: number;
}
