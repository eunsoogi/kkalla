import type { AllocationAuditService } from '@/modules/allocation-audit/allocation-audit.service';
import type {
  AllocationRecommendationAction,
  AllocationRecommendationData,
  RecommendationItem,
} from '@/modules/allocation-core/allocation-core.types';
import type { NormalizedAllocationRecommendationResponse } from '@/modules/allocation-core/helpers/allocation-recommendation';
import type { TradeOrchestrationService } from '@/modules/allocation-core/trade-orchestration.service';
import type { LatestRecommendationMetrics } from '@/modules/allocation-core/trade-orchestration.types';
import type { ErrorService } from '@/modules/error/error.service';
import type { FeatureService } from '@/modules/feature/feature.service';
import type { MarketRegimeService } from '@/modules/market-regime/market-regime.service';
import type { Feargreed, MarketRegimeSnapshot } from '@/modules/market-regime/market-regime.types';
import type { NewsService } from '@/modules/news/news.service';
import type { OpenaiService } from '@/modules/openai/openai.service';
import type { ResponseCreateConfig } from '@/modules/openai/openai.types';
import type { MarketFeatures } from '@/modules/upbit/upbit.types';

export interface RecommendationInferenceLogger {
  error(message: string, trace?: unknown): void;
  warn(message: string, trace?: unknown): void;
}

export interface RecommendationInferenceTranslator {
  t(key: string, options?: Record<string, unknown>): string;
}

export interface RecommendationRealtimeInferenceHandlers {
  onNewsError: (error: unknown) => void;
  onMarketRegimeError: (error: unknown) => void;
  onValidationGuardrailError: (error: unknown, symbol: string) => void;
  onUnexpectedSymbol: (args: { outputSymbol: string }) => void;
  onDuplicateSymbol: (args: { outputSymbol: string }) => void;
  onInferenceFailed: (error: unknown) => void;
  buildIncompleteResponseError: (args: { expectedCount: number; receivedCount: number }) => string;
  buildMissingResponseError: (args: { symbol: string }) => string;
}

export interface RecommendationModelSignals {
  buyScore: number;
  sellScore: number;
  modelTargetWeight: number;
}

export type RecommendationTradeCostTelemetry = Pick<
  AllocationRecommendationData,
  'expectedEdgeRate' | 'estimatedCostRate' | 'spreadRate' | 'impactRate'
>;

export type RecommendationResultDraft = Omit<AllocationRecommendationData, 'id' | 'batchId'>;

export interface RecommendationTargetSymbolContext<TItem extends RecommendationItem> {
  item: TItem;
  targetSymbol: string;
}

export interface RealtimeRecommendationResultContext<TItem extends RecommendationItem> {
  item: TItem;
  targetSymbol: string;
  responseData: unknown;
  normalizedResponse: NormalizedAllocationRecommendationResponse | null;
  marketFeatures: MarketFeatures | null;
  marketRegime: MarketRegimeSnapshot | null;
  feargreed: Feargreed | null;
}

export interface BaselineWeightContext<TItem extends RecommendationItem> {
  item: TItem;
  currentHoldingWeight: number;
  previousModelTargetWeight: number | null;
}

export interface NeutralWeightContext<TItem extends RecommendationItem> {
  item: TItem;
  previousModelTargetWeight: number | null;
  modelTargetWeight: number;
}

export interface RecommendationActionContext {
  modelAction: AllocationRecommendationAction;
  decisionConfidence: number;
  currentHoldingWeight: number | null;
  nextModelTargetWeight: number;
  minRecommendWeight: number;
}

export interface RecommendationBuilderConfig<TItem extends RecommendationItem> {
  latestMetricsBySymbol: Map<string, LatestRecommendationMetrics>;
  clampToUnitInterval: (value: number) => number;
  calculateModelSignals: (
    intensity: number,
    category: TItem['category'],
    marketFeatures: MarketFeatures | null,
    symbol: string,
    previousModelTargetWeight?: number | null,
  ) => RecommendationModelSignals;
  deriveTradeCostTelemetry: (
    marketFeatures: MarketFeatures | null,
    expectedVolatilityPct: number,
    decisionConfidence: number,
  ) => RecommendationTradeCostTelemetry;
  resolveInferenceActionBaselineWeight: (context: BaselineWeightContext<TItem>) => number | null;
  resolveNeutralModelTargetWeight: (context: NeutralWeightContext<TItem>) => number;
  resolveInferenceRecommendationAction: (
    previousModelTargetWeight: number | null,
    currentModelTargetWeight: number,
  ) => AllocationRecommendationAction;
  resolveServerRecommendationAction: (context: RecommendationActionContext) => AllocationRecommendationAction;
  minRecommendWeight: number;
}

export interface SharedRecommendationBuilderOptions<TItem extends RecommendationItem> {
  latestMetricsBySymbol: Map<string, LatestRecommendationMetrics>;
  tradeOrchestrationService: Pick<
    TradeOrchestrationService,
    | 'clampToUnitInterval'
    | 'resolveNeutralModelTargetWeight'
    | 'resolveInferenceRecommendationAction'
    | 'resolveServerRecommendationAction'
    | 'getMinimumRecommendWeight'
  >;
  calculateModelSignals: RecommendationBuilderConfig<TItem>['calculateModelSignals'];
  deriveTradeCostTelemetry: RecommendationBuilderConfig<TItem>['deriveTradeCostTelemetry'];
  resolveInferenceActionBaselineWeight: RecommendationBuilderConfig<TItem>['resolveInferenceActionBaselineWeight'];
  minRecommendWeight?: number;
}

type RecommendationRealtimeTradeOrchestrationService = Pick<
  TradeOrchestrationService,
  | 'buildLatestRecommendationMetricsMap'
  | 'inferRecommendationsInRealtime'
  | 'persistAllocationRecommendationBatch'
  | 'clampToUnitInterval'
  | 'resolveNeutralModelTargetWeight'
  | 'resolveInferenceRecommendationAction'
  | 'resolveServerRecommendationAction'
  | 'getMinimumRecommendWeight'
>;

export interface RecommendationRealtimeFlowOptions<TItem extends RecommendationItem> {
  items: TItem[];
  normalizeTargetSymbol: (item: TItem) => string;
  onSymbolNormalized?: (context: RecommendationTargetSymbolContext<TItem>) => void;
  logger: RecommendationInferenceLogger;
  i18n: RecommendationInferenceTranslator;
  responseLabel: string;
  tradeOrchestrationService: RecommendationRealtimeTradeOrchestrationService;
  prompt: string;
  createRequestConfig: (maxItems: number) => ResponseCreateConfig;
  openaiService: Pick<OpenaiService, 'addMessage' | 'addPromptPair' | 'createResponse' | 'getResponseOutput'>;
  featureService: Pick<FeatureService, 'MARKET_DATA_LEGEND' | 'extractMarketFeatures' | 'formatMarketData'>;
  newsService: Pick<NewsService, 'getCompactNews'>;
  marketRegimeService: Pick<MarketRegimeService, 'getSnapshot'>;
  errorService: Pick<ErrorService, 'retryWithFallback'>;
  allocationAuditService: Pick<AllocationAuditService, 'buildAllocationValidationGuardrailText'>;
  onLatestMetricsError: (error: unknown) => void;
  createResultBuilder: (
    latestMetricsBySymbol: Map<string, LatestRecommendationMetrics>,
  ) => (context: RealtimeRecommendationResultContext<TItem>) => RecommendationResultDraft | null;
  onBeforePersist?: (count: number) => void;
  enqueueAllocationBatchValidation: (batchId: string) => Promise<void>;
  onEnqueueValidationError: (error: unknown) => void;
}

export interface RecommendationRealtimeSharedBuilderFlowOptions<TItem extends RecommendationItem> extends Omit<
  RecommendationRealtimeFlowOptions<TItem>,
  'createResultBuilder'
> {
  calculateModelSignals: SharedRecommendationBuilderOptions<TItem>['calculateModelSignals'];
  deriveTradeCostTelemetry: SharedRecommendationBuilderOptions<TItem>['deriveTradeCostTelemetry'];
  resolveInferenceActionBaselineWeight: SharedRecommendationBuilderOptions<TItem>['resolveInferenceActionBaselineWeight'];
  minRecommendWeight?: number;
}
