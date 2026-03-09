import { AllocationRecommendationAction } from '@/modules/allocation-core/allocation-core.types';
import { CategoryItemCountConfig } from '@/modules/allocation-core/helpers/recommendation-item';
import { MarketFeatures } from '@/modules/upbit/upbit.types';

export interface FeatureScoreConfig {
  featureConfidenceWeight: number;
  featureMomentumWeight: number;
  featureLiquidityWeight: number;
  featureVolatilityWeight: number;
  featureStabilityWeight: number;
  volatilityReference: number;
}

export interface RecommendationFilterConfig {
  minimumTradeIntensity: number;
  minAllocationConfidence: number;
}

export interface CategoryRecommendationFilterConfig extends RecommendationFilterConfig {
  categoryItemCountConfig?: CategoryItemCountConfig;
}

export interface ParsedAllocationRecommendationResponse {
  symbol?: unknown;
  intensity?: unknown;
  confidence?: unknown;
  expectedVolatilityPct?: unknown;
  riskFlags?: unknown;
  reason?: unknown;
}

export interface ParsedAllocationRecommendationBatchResponse {
  recommendations?: unknown;
}

export interface NormalizedAllocationRecommendationResponse {
  intensity: number;
  confidence: number;
  expectedVolatilityPct: number;
  riskFlags: string[];
  reason: string;
}

export interface NormalizedAllocationRecommendationBatchItem {
  raw: ParsedAllocationRecommendationResponse;
  normalized: NormalizedAllocationRecommendationResponse;
}

export interface NormalizeAllocationRecommendationResponseOptions {
  expectedSymbol: string;
  dropOnSymbolMismatch?: boolean;
  onSymbolMismatch?: (args: { outputSymbol: string; expectedSymbol: string }) => void;
}

export interface NormalizeAllocationRecommendationBatchResponseOptions {
  expectedSymbols: string[];
  onUnexpectedSymbol?: (args: { outputSymbol: string }) => void;
  onDuplicateSymbol?: (args: { outputSymbol: string }) => void;
}

export interface NormalizePercentToRateOptions {
  legacyPercentagePointHint?: boolean;
}

export interface ResolveInferenceRecommendationActionOptions {
  previousModelTargetWeight: number | null | undefined;
  currentModelTargetWeight: number | null | undefined;
}

export interface ResolveConsumeRecommendationActionOptions {
  currentHoldingWeight: number | null | undefined;
  currentModelTargetWeight: number | null | undefined;
}

export interface ResolveServerRecommendationActionOptions {
  modelAction: AllocationRecommendationAction;
  decisionConfidence: number;
  minimumAllocationConfidence: number;
  currentHoldingWeight?: number | null;
  nextModelTargetWeight?: number | null;
  minRecommendWeight?: number;
  targetSlotCount?: number;
}

export interface CalculateAllocationModelSignalsOptions {
  intensity: number;
  marketFeatures: MarketFeatures | null;
  previousModelTargetWeight?: number | null;
  featureScoreConfig: FeatureScoreConfig;
  aiSignalWeight: number;
  featureSignalWeight: number;
  minimumTradeIntensity: number;
  sellScoreThreshold: number;
}

export interface AllocationModelSignals {
  featureScore: number;
  buyScore: number;
  sellScore: number;
  modelTargetWeight: number;
  action: AllocationRecommendationAction;
}

export interface ScaleBuyRequestsToAvailableKrwOptions {
  tradableMarketValueMap?: Map<string, number>;
  fallbackMarketPrice?: number;
  minimumTradePrice: number;
  onBudgetInsufficient?: (args: { availableKrw: number; totalEstimated: number; requestedCount: number }) => void;
  onBudgetScaled?: (args: {
    availableKrw: number;
    totalEstimated: number;
    scale: number;
    requestedCount: number;
  }) => void;
}

export interface ApplyNotionalBudgetToRankedRequestsOptions {
  budgetNotional: number;
  minimumTradePrice: number;
}

export interface ApplyNotionalBudgetToRankedRequestsResult<TRequest> {
  requestedNotional: number;
  selectedNotional: number;
  selectedRequests: TRequest[];
  skippedRequests: TRequest[];
  partialScaledRequest: TRequest | null;
}
