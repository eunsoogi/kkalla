import { Category } from '../category/category.enum';

export interface RecommendationItem {
  symbol: string;
  category: Category;
  hasStock: boolean;
  weight?: number;
  confidence?: number;
}

export type AllocationRecommendationAction = 'buy' | 'sell' | 'hold' | 'no_trade';
export type AllocationMode = 'new' | 'existing';
export type TradeExecutionMessageModule = 'allocation' | 'risk';
export type TradeExecutionQueueModuleLabel = TradeExecutionMessageModule | 'rebalance' | 'volatility';

export interface AllocationRecommendationData {
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
  action?: AllocationRecommendationAction;
  hasStock: boolean;
  weight?: number;
  confidence?: number;
  decisionConfidence?: number;
  expectedVolatilityPct?: number;
  riskFlags?: string[];
}

export interface TradeExecutionMessageV2 {
  version: 2;
  module: TradeExecutionMessageModule;
  runId: string;
  messageKey: string;
  userId: string;
  generatedAt: string;
  expiresAt: string;
  allocationMode?: AllocationMode;
  inferences: AllocationRecommendationData[];
}

export interface QueueTradeExecutionMessageV2 extends Omit<TradeExecutionMessageV2, 'module'> {
  module: TradeExecutionQueueModuleLabel;
}
