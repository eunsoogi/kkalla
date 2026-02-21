import { Category } from '../category/category.enum';
import { SortDirection } from '../item/item.enum';

export interface BalanceRecommendationFilter {
  symbol?: string;
  category?: Category;
  startDate?: Date;
  endDate?: Date;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  sortDirection?: SortDirection;
}

export interface RecentBalanceRecommendationRequest {
  symbol: string;
  createdAt: Date;
  count: number;
}

export interface RecommendationItem {
  symbol: string;
  category: Category;
  hasStock: boolean;
  weight?: number;
  confidence?: number;
}

export type BalanceRecommendationAction = 'buy' | 'sell' | 'hold' | 'no_trade';
export type RebalancePortfolioMode = 'new' | 'existing';

export interface BalanceRecommendationData {
  id: string;
  batchId: string;
  symbol: string;
  category: Category;
  intensity: number;
  reason?: string | null;
  prevIntensity?: number | null;
  prevModelTargetWeight?: number | null;
  buyScore?: number;
  sellScore?: number;
  modelTargetWeight?: number;
  action?: BalanceRecommendationAction;
  hasStock: boolean;
  weight?: number;
  confidence?: number;
  decisionConfidence?: number;
  expectedVolatilityPct?: number;
  riskFlags?: string[];
}

export interface TradeExecutionMessageV2 {
  version: 2;
  module: 'rebalance' | 'volatility';
  runId: string;
  messageKey: string;
  userId: string;
  generatedAt: string;
  expiresAt: string;
  portfolioMode?: RebalancePortfolioMode;
  inferences: BalanceRecommendationData[];
}
