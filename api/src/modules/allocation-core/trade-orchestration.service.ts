import { Injectable } from '@nestjs/common';

import { Balances, Order } from 'ccxt';

import { AllocationRecommendation } from '@/modules/allocation/entities/allocation-recommendation.entity';
import { Category } from '@/modules/category/category.enum';
import type { ErrorService } from '@/modules/error/error.service';
import type { FeatureService } from '@/modules/feature/feature.service';
import type { MarketRegimeService } from '@/modules/market-regime/market-regime.service';
import type { Feargreed, MarketRegimeSnapshot } from '@/modules/market-regime/market-regime.types';
import type { NewsService } from '@/modules/news/news.service';
import { toUserFacingText } from '@/modules/openai/openai-citation.util';
import type { OpenaiService } from '@/modules/openai/openai.service';
import type { ResponseCreateConfig } from '@/modules/openai/openai.types';
import { executeTradesSequentiallyWithRequests } from '@/modules/trade-execution-ledger/helpers/trade-execution-runner';
import { Trade } from '@/modules/trade/entities/trade.entity';
import { TradeData, TradeRequest } from '@/modules/trade/trade.types';
import { UPBIT_MINIMUM_TRADE_PRICE } from '@/modules/upbit/upbit.constant';
import { OrderTypes } from '@/modules/upbit/upbit.enum';
import { AdjustedOrderResult, MarketFeatures } from '@/modules/upbit/upbit.types';
import { User } from '@/modules/user/entities/user.entity';
import { generateMonotonicUlid } from '@/utils/id';
import { clamp01 } from '@/utils/math';
import { formatNumber, formatPercent } from '@/utils/number';
import { normalizeKrwSymbol } from '@/utils/symbol';

import type { AllocationAuditService } from '../allocation-audit/allocation-audit.service';
import { SHARED_REBALANCE_POLICY, SHARED_TRADE_EXECUTION_RUNTIME } from './allocation-core.constants';
import {
  AllocationRecommendationAction,
  AllocationRecommendationData,
  CategoryExposureCaps,
  MarketRegimePolicy,
  RecommendationItem,
  TradeExecutionMessageV2,
} from './allocation-core.types';
import {
  applyNotionalBudgetToRankedRequests,
  calculateAllocationBand,
  calculateAllocationModelSignals,
  calculateRegimeAdjustedTargetWeight,
  calculateRelativeDiff,
  estimateTradeNotionalFromRequest,
  filterExcludedRecommendationsByCategory,
  filterIncludedRecommendationsByCategory,
  isNoTradeRecommendation,
  isOrderableSymbol,
  isSellAmountSufficient,
  normalizeAllocationRecommendationBatchResponsePayload,
  normalizeCandidateWeight,
  resolveAvailableKrwBalance,
  resolveConsumeRecommendationAction,
  resolveInferenceRecommendationAction as resolveInferenceRecommendationActionByWeight,
  resolveNeutralModelTargetWeight,
  resolveServerRecommendationAction,
  scaleBuyRequestsToAvailableKrw,
  shouldReallocate,
} from './helpers/allocation-recommendation';
import type { NormalizedAllocationRecommendationResponse } from './helpers/allocation-recommendation';
import { buildAllocationRecommendationPromptMessages } from './helpers/allocation-recommendation-context';
import type { RecommendationResultDraft } from './helpers/allocation-recommendation-realtime.types';
import {
  applyHeldAssetFlags,
  filterAuthorizedRecommendationItems,
  filterUniqueNonBlacklistedItems,
} from './helpers/recommendation-item';
import {
  BuildInferredHoldingItemsOptions,
  BuildLatestRecommendationMetricsMapOptions,
  BuildOrderableSymbolSetOptions,
  BuildTradeExecutionSnapshotOptions,
  ExcludedTradeRequestBuildOptions,
  ExecuteRebalanceTradesOptions,
  ExecuteTradeOptions,
  ExecutionRequestLike,
  ExecutionTradeLike,
  HoldingLedgerRemoveItem,
  HoldingLedgerSaveItem,
  IncludedTradeRequestBuildOptions,
  LatestRecommendationMetrics,
  MarketRegimeReaderResult,
  NoTradeTrimRequestBuildOptions,
  PayoffOverlayResult,
  RecommendationMetricsErrorService,
  ResolveTradeExecutionFillMetricsOptions,
  TradeExecutionFillMetrics,
  TradeExecutionSnapshot,
  TradePolicyConfig,
  TradeRuntimeContext,
} from './trade-orchestration.types';

class RealtimeRecommendationResponseError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'RealtimeRecommendationResponseError';
    if (options && 'cause' in options) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

/**
 * Shared trading orchestration service used by allocation and market-risk flows.
 */
@Injectable()
export class TradeOrchestrationService {
  /**
   * Default trade policy shared by allocation/risk flows.
   * Callers may still override by explicitly passing `policy`.
   */
  private readonly defaultTradePolicy: TradePolicyConfig = {
    minimumAllocationConfidence: SHARED_REBALANCE_POLICY.minAllocationConfidence,
    minimumAllocationBand: SHARED_REBALANCE_POLICY.minAllocationBand,
    allocationBandRatio: SHARED_REBALANCE_POLICY.allocationBandRatio,
    estimatedFeeRate: SHARED_REBALANCE_POLICY.estimatedFeeRate,
    estimatedSlippageRate: SHARED_REBALANCE_POLICY.estimatedSlippageRate,
    edgeRiskBufferRate: SHARED_REBALANCE_POLICY.edgeRiskBufferRate,
    stagedExitLight: SHARED_REBALANCE_POLICY.stagedExitLight,
    stagedExitMedium: SHARED_REBALANCE_POLICY.stagedExitMedium,
    stagedExitFull: SHARED_REBALANCE_POLICY.stagedExitFull,
    payoffOverlayStopLossMin: SHARED_REBALANCE_POLICY.payoffOverlayStopLossMin,
    payoffOverlayTrailingMin: SHARED_REBALANCE_POLICY.payoffOverlayTrailingMin,
    minimumTradePrice: UPBIT_MINIMUM_TRADE_PRICE,
  };
  private readonly minimumTradeIntensity = SHARED_REBALANCE_POLICY.minimumTradeIntensity;
  private readonly tradeExecutionRuntime = SHARED_TRADE_EXECUTION_RUNTIME;
  private readonly fullLiquidationFillRatioThreshold = 0.995;
  private readonly fullLiquidationVolumeEpsilon = 1e-8;
  private readonly marketOrderReconcileMaxFetchAttempts =
    this.tradeExecutionRuntime.marketOrderReconcileMaxFetchAttempts;
  private readonly marketOrderReconcileRetryDelayMs = this.tradeExecutionRuntime.marketOrderReconcileRetryDelayMs;
  private readonly realtimeRecommendationRetryOptions = {
    firstPhase: { maxRetries: 3, retryDelay: 1000 },
    secondPhase: { maxRetries: 1, retryDelay: 1000 },
  } as const;

  /**
   * Shared queue message version used by allocation/risk SQS producers and consumers.
   */
  public getQueueMessageVersion(): TradeExecutionMessageV2['version'] {
    return this.tradeExecutionRuntime.queueMessageVersion;
  }

  /**
   * Shared message TTL used by allocation/risk queue payloads.
   */
  public getMessageTtlMs(): number {
    return this.tradeExecutionRuntime.messageTtlMs;
  }

  /**
   * Shared user-level trade lock duration for allocation/risk trade execution.
   */
  public getUserTradeLockDurationMs(): number {
    return this.tradeExecutionRuntime.userTradeLockDurationMs;
  }

  /**
   * Shared heartbeat interval while processing allocation/risk queue messages.
   */
  public getProcessingHeartbeatIntervalMs(): number {
    return this.tradeExecutionRuntime.processingHeartbeatIntervalMs;
  }

  /**
   * Shared minimum confidence threshold used by allocation/risk recommendation filtering.
   */
  public getMinimumAllocationConfidence(): number {
    return this.defaultTradePolicy.minimumAllocationConfidence;
  }

  /**
   * Shared minimum recommend weight used by allocation/risk neutral fallback.
   */
  public getMinimumRecommendWeight(): number {
    return SHARED_REBALANCE_POLICY.minRecommendWeight;
  }

  /**
   * Shared minimum trade intensity threshold used by allocation/risk recommendation filtering.
   */
  public getMinimumTradeIntensity(): number {
    return this.minimumTradeIntensity;
  }

  /**
   * Shared server-side action resolution for allocation/risk recommendation outputs.
   */
  public resolveServerRecommendationAction(options: {
    modelAction: AllocationRecommendationAction;
    decisionConfidence: number;
    currentHoldingWeight?: number | null;
    nextModelTargetWeight?: number | null;
    minRecommendWeight?: number;
    targetSlotCount?: number;
  }): AllocationRecommendationAction {
    return resolveServerRecommendationAction({
      ...options,
      minimumAllocationConfidence: this.defaultTradePolicy.minimumAllocationConfidence,
      minRecommendWeight: options.minRecommendWeight ?? SHARED_REBALANCE_POLICY.minRecommendWeight,
    });
  }

  /**
   * Recomputes recommendation actions using user-scoped holding weights.
   */
  public applyUserScopedRecommendationActions(options: {
    inferences: AllocationRecommendationData[];
    currentWeights: Map<string, number>;
    targetSlotCount: number;
  }): AllocationRecommendationData[] {
    const targetSlotCount = Math.max(1, options.targetSlotCount);
    const minRecommendWeight = SHARED_REBALANCE_POLICY.minRecommendWeight;

    return options.inferences.map((inference) => {
      const nextModelTargetWeight = normalizeCandidateWeight(inference.modelTargetWeight);
      const currentHoldingWeight = this.clampToUnitInterval(options.currentWeights.get(inference.symbol) ?? 0);
      // Consume stage ignores persisted action and derives direction from user's live holding delta.
      const modelAction = resolveConsumeRecommendationAction({
        currentHoldingWeight,
        currentModelTargetWeight: nextModelTargetWeight,
      });
      const decisionConfidence =
        inference.decisionConfidence != null && Number.isFinite(inference.decisionConfidence)
          ? Number(inference.decisionConfidence)
          : 1;

      const action = this.resolveServerRecommendationAction({
        modelAction,
        decisionConfidence,
        currentHoldingWeight,
        nextModelTargetWeight,
        minRecommendWeight,
        targetSlotCount,
      });
      const resolvedModelTargetWeight = action === 'hold' ? currentHoldingWeight : nextModelTargetWeight;

      return {
        ...inference,
        action,
        modelTargetWeight: resolvedModelTargetWeight,
      };
    });
  }

  /**
   * Shared neutral target-weight resolution for hold/non-trading outputs.
   */
  public resolveNeutralModelTargetWeight(
    previousModelTargetWeight: number | null | undefined,
    suggestedWeight: number | null | undefined,
    fallbackModelTargetWeight: number,
    hasStock: boolean,
    minRecommendWeight: number = SHARED_REBALANCE_POLICY.minRecommendWeight,
  ): number {
    return resolveNeutralModelTargetWeight(
      previousModelTargetWeight,
      suggestedWeight,
      fallbackModelTargetWeight,
      hasStock,
      minRecommendWeight,
    );
  }

  /**
   * Shared inference-stage action resolution from previous/current model target weights.
   */
  public resolveInferenceRecommendationAction(
    previousModelTargetWeight: number | null | undefined,
    currentModelTargetWeight: number | null | undefined,
  ): AllocationRecommendationAction {
    return resolveInferenceRecommendationActionByWeight({
      previousModelTargetWeight,
      currentModelTargetWeight,
    });
  }

  /**
   * Shared staged-exit medium diff used by partial de-risking flows.
   */
  public getStagedExitMediumDiff(): number {
    return this.defaultTradePolicy.stagedExitMedium;
  }

  /**
   * Shared clamp utility for allocation/risk model outputs.
   */
  public clampToUnitInterval(value: number): number {
    return clamp01(value);
  }

  /**
   * Shared model signal calculation with unified policy weights.
   */
  public calculateModelSignals(
    intensity: number,
    marketFeatures: MarketFeatures | null,
    previousModelTargetWeight?: number | null,
  ) {
    return calculateAllocationModelSignals({
      intensity,
      marketFeatures,
      previousModelTargetWeight,
      featureScoreConfig: {
        featureConfidenceWeight: SHARED_REBALANCE_POLICY.featureConfidenceWeight,
        featureMomentumWeight: SHARED_REBALANCE_POLICY.featureMomentumWeight,
        featureLiquidityWeight: SHARED_REBALANCE_POLICY.featureLiquidityWeight,
        featureVolatilityWeight: SHARED_REBALANCE_POLICY.featureVolatilityWeight,
        featureStabilityWeight: SHARED_REBALANCE_POLICY.featureStabilityWeight,
        volatilityReference: SHARED_REBALANCE_POLICY.volatilityReference,
      },
      aiSignalWeight: SHARED_REBALANCE_POLICY.aiSignalWeight,
      featureSignalWeight: SHARED_REBALANCE_POLICY.featureSignalWeight,
      minimumTradeIntensity: this.minimumTradeIntensity,
      sellScoreThreshold: SHARED_REBALANCE_POLICY.sellScoreThreshold,
    });
  }

  /**
   * Shared regime-adjusted target weight calculation.
   */
  public calculateRegimeAdjustedTargetWeight(baseTargetWeight: number, regimeMultiplier: number): number {
    return calculateRegimeAdjustedTargetWeight(baseTargetWeight, regimeMultiplier);
  }

  /**
   * Shared trade cost telemetry used in allocation/risk recommendation persistence.
   */
  public deriveTradeCostTelemetry(
    marketFeatures: MarketFeatures | null,
    expectedVolatilityPct: number,
    decisionConfidence: number,
  ): Pick<AllocationRecommendationData, 'expectedEdgeRate' | 'estimatedCostRate' | 'spreadRate' | 'impactRate'> {
    const normalizedLiquidity = clamp01((marketFeatures?.liquidityScore ?? 0) / 10);
    const normalizedVolatility = this.normalizeExpectedVolatilityRate(expectedVolatilityPct);
    const normalizedTrendPersistence = clamp01((marketFeatures?.prediction?.trendPersistence ?? 50) / 100);
    const spreadRate = Math.max(0.0003, (1 - normalizedLiquidity) * 0.003);
    const impactRate = Math.max(0.0002, normalizedVolatility * (1 - normalizedLiquidity) * 0.5);
    const estimatedCostRate = this.defaultTradePolicy.estimatedFeeRate + spreadRate + impactRate;
    const expectedEdgeRate = clamp01(clamp01(decisionConfidence) * Math.max(0, normalizedTrendPersistence - 0.3));

    return {
      expectedEdgeRate,
      estimatedCostRate,
      spreadRate,
      impactRate,
    };
  }

  /**
   * Shared holding scope application for recommendation items.
   */
  public applyHeldAssetFlags<
    T extends {
      symbol: string;
      category: string | number;
      hasStock: boolean;
    },
  >(inferences: T[], holdingItems: Array<{ symbol: string; category: string | number }>): T[] {
    return applyHeldAssetFlags(inferences, holdingItems);
  }

  /**
   * Shared authorization filtering for recommendation items.
   */
  public filterAuthorizedRecommendationItems<TUser, TItem extends { category: Category }>(
    user: TUser,
    items: TItem[],
    enabledCategories: Array<{ category: Category }>,
    hasPermission: (user: TUser, category: Category) => boolean,
  ): TItem[] {
    return filterAuthorizedRecommendationItems(user, items, enabledCategories, hasPermission);
  }

  /**
   * Shared unique + blacklist filtering for recommendation item lists.
   */
  public filterUniqueNonBlacklistedItems<T extends { symbol: string; category: string | number }>(
    items: T[],
    blacklist: Array<{ symbol: string; category: string | number }>,
  ): { items: T[]; filteredSymbols: string[] } {
    return filterUniqueNonBlacklistedItems(items, blacklist);
  }

  /**
   * Shared fear-greed to exposure multiplier mapping.
   */
  public getMarketRegimeMultiplierByFearGreedIndex(value: number): number {
    if (!Number.isFinite(value)) {
      return 1;
    }

    if (value <= 20) {
      return 0.95;
    }
    if (value <= 35) {
      return 0.97;
    }
    if (value >= 80) {
      return 0.97;
    }
    if (value >= 65) {
      return 0.99;
    }

    return 1;
  }

  /**
   * Shared market-signal adjustment for regime multiplier.
   */
  public getMarketRegimeMultiplierAdjustmentByMarketSignals(btcDominance: number, altcoinIndex: number): number {
    if (!Number.isFinite(btcDominance) || !Number.isFinite(altcoinIndex)) {
      return 0;
    }

    let adjustment = 0;
    if (btcDominance >= 58) {
      adjustment -= 0.02;
    } else if (btcDominance <= 48) {
      adjustment += 0.01;
    }

    if (altcoinIndex >= 75) {
      adjustment += 0.02;
    } else if (altcoinIndex <= 25) {
      adjustment -= 0.02;
    }

    return Math.max(-0.03, Math.min(0.03, adjustment));
  }

  /**
   * Shared regime multiplier resolver.
   */
  public async resolveMarketRegimeMultiplier(
    readMarketRegime: () => Promise<MarketRegimeReaderResult | null | undefined>,
  ): Promise<number> {
    const policy = await this.resolveMarketRegimePolicy(readMarketRegime);
    return policy.exposureMultiplier;
  }

  /**
   * Resolves market-regime policy knobs used by allocation and risk rebalancing.
   * @param readMarketRegime - Async reader for market-regime snapshot values.
   * @returns Clamped regime policy (exposure, rebalance band, turnover cap, category caps).
   */
  public async resolveMarketRegimePolicy(
    readMarketRegime: () => Promise<MarketRegimeReaderResult | null | undefined>,
  ): Promise<MarketRegimePolicy> {
    try {
      const marketRegime = await readMarketRegime();
      // Build policy knobs from imperfect market data and clamp every output
      // so sudden feed spikes do not explode holdings sizing.
      const fearGreed = marketRegime?.feargreed;
      const baseMultiplier = this.getMarketRegimeMultiplierByFearGreedIndex(Number(fearGreed?.index));
      const adjustment = this.getMarketRegimeMultiplierAdjustmentByMarketSignals(
        Number(marketRegime?.btcDominance),
        Number(marketRegime?.altcoinIndex),
      );
      const exposureMultiplier = Math.max(0.75, Math.min(1.15, baseMultiplier + adjustment));
      const rebalanceBandMultiplier = Math.max(
        0.85,
        Math.min(
          1.5,
          1 +
            (Number(marketRegime?.btcDominance) >= 58 ? 0.1 : 0) +
            (Number(marketRegime?.altcoinIndex) <= 25 ? 0.1 : 0) -
            (Number(marketRegime?.altcoinIndex) >= 75 ? 0.08 : 0),
        ),
      );
      const turnoverCap = Math.max(
        0.2,
        Math.min(
          1,
          0.55 +
            (Number(marketRegime?.btcDominance) >= 58 ? -0.15 : 0) +
            (Number(marketRegime?.altcoinIndex) <= 25 ? -0.1 : 0) +
            (Number(marketRegime?.altcoinIndex) >= 75 ? 0.15 : 0),
        ),
      );
      const categoryExposureCaps: CategoryExposureCaps = {
        coinMajor: Math.max(
          0.35,
          Math.min(
            0.85,
            0.6 +
              (Number(marketRegime?.btcDominance) >= 58 ? 0.12 : 0) +
              (Number(marketRegime?.altcoinIndex) <= 25 ? 0.08 : 0) -
              (Number(marketRegime?.altcoinIndex) >= 75 ? 0.1 : 0),
          ),
        ),
        coinMinor: Math.max(
          0.15,
          Math.min(
            0.8,
            0.45 +
              (Number(marketRegime?.btcDominance) >= 58 ? -0.12 : 0) +
              (Number(marketRegime?.altcoinIndex) <= 25 ? -0.1 : 0) +
              (Number(marketRegime?.altcoinIndex) >= 75 ? 0.2 : 0),
          ),
        ),
        nasdaq: Math.max(
          0.1,
          Math.min(
            0.4,
            0.25 +
              (Number(marketRegime?.btcDominance) >= 58 ? -0.05 : 0) +
              (Number(marketRegime?.altcoinIndex) <= 25 ? -0.03 : 0) +
              (Number(marketRegime?.altcoinIndex) >= 75 ? 0.03 : 0),
          ),
        ),
      };

      return {
        exposureMultiplier,
        rebalanceBandMultiplier,
        turnoverCap,
        categoryExposureCaps,
      };
    } catch {
      // Fall back to neutral policy when regime reader is temporarily unavailable.
      return {
        exposureMultiplier: 1,
        rebalanceBandMultiplier: 1,
        turnoverCap: 0.55,
        categoryExposureCaps: {
          coinMajor: 0.6,
          coinMinor: 0.45,
          nasdaq: 0.25,
        },
      };
    }
  }

  /**
   * Loads recent recommendation rows for the provided symbols in a single query.
   */
  private async fetchLatestRecommendationsBySymbols(
    symbols: string[],
    errorService: RecommendationMetricsErrorService,
    onError: (error: unknown) => void,
  ): Promise<AllocationRecommendation[]> {
    const operation = () => {
      const queryBuilder = AllocationRecommendation.createQueryBuilder('recommendation');
      const latestRecommendationIdSubQuery = queryBuilder
        .subQuery()
        .select('newer.id')
        .from(AllocationRecommendation, 'newer')
        .where('newer.symbol = recommendation.symbol')
        .orderBy('newer.createdAt', 'DESC')
        .addOrderBy('newer.id', 'DESC')
        .limit(1)
        .getQuery();

      return queryBuilder
        .where('recommendation.symbol IN (:...symbols)', { symbols })
        .andWhere(`recommendation.id = ${latestRecommendationIdSubQuery}`)
        .orderBy('recommendation.symbol', 'ASC')
        .getMany();
    };

    try {
      return await errorService.retryWithFallback(operation);
    } catch (error) {
      // Metrics are enrichment data; return empty and let caller continue.
      onError(error);
      return [];
    }
  }

  /**
   * Shared lookup for latest recommendation metrics by symbol.
   */
  public async buildLatestRecommendationMetricsMap(
    options: BuildLatestRecommendationMetricsMapOptions,
  ): Promise<Map<string, LatestRecommendationMetrics>> {
    const requestedSymbolsByQuerySymbol = new Map<string, Set<string>>();

    for (const item of options.recommendationItems) {
      const requestedSymbol = item.symbol;
      const querySymbol = this.normalizeRecommendationMetricsLookupSymbol(item);
      const requestedSymbols = requestedSymbolsByQuerySymbol.get(querySymbol) ?? new Set<string>();
      requestedSymbols.add(requestedSymbol);
      requestedSymbolsByQuerySymbol.set(querySymbol, requestedSymbols);
    }

    const querySymbols = Array.from(requestedSymbolsByQuerySymbol.keys());
    if (querySymbols.length < 1) {
      return new Map();
    }

    const recentRecommendations = await this.fetchLatestRecommendationsBySymbols(
      querySymbols,
      options.errorService,
      options.onError,
    );
    const latestRecommendationMetricsBySymbol = new Map<string, LatestRecommendationMetrics>();

    for (const recommendation of recentRecommendations) {
      const latestMetrics = {
        intensity:
          recommendation.intensity != null && Number.isFinite(recommendation.intensity)
            ? Number(recommendation.intensity)
            : null,
        modelTargetWeight:
          recommendation.modelTargetWeight != null && Number.isFinite(recommendation.modelTargetWeight)
            ? Number(recommendation.modelTargetWeight)
            : null,
      };

      latestRecommendationMetricsBySymbol.set(recommendation.symbol, latestMetrics);

      const requestedSymbols = requestedSymbolsByQuerySymbol.get(recommendation.symbol);
      if (!requestedSymbols) {
        continue;
      }

      for (const requestedSymbol of requestedSymbols) {
        latestRecommendationMetricsBySymbol.set(requestedSymbol, latestMetrics);
      }
    }

    for (const [querySymbol, requestedSymbols] of requestedSymbolsByQuerySymbol) {
      if (!latestRecommendationMetricsBySymbol.has(querySymbol)) {
        latestRecommendationMetricsBySymbol.set(querySymbol, {
          intensity: null,
          modelTargetWeight: null,
        });
      }

      for (const requestedSymbol of requestedSymbols) {
        if (!latestRecommendationMetricsBySymbol.has(requestedSymbol)) {
          latestRecommendationMetricsBySymbol.set(requestedSymbol, {
            intensity: null,
            modelTargetWeight: null,
          });
        }
      }
    }

    return latestRecommendationMetricsBySymbol;
  }

  private normalizeRecommendationMetricsLookupSymbol(item: Pick<RecommendationItem, 'symbol' | 'category'>): string {
    if (item.category === Category.NASDAQ) {
      return item.symbol.trim().toUpperCase();
    }

    return normalizeKrwSymbol(item.symbol) ?? item.symbol;
  }

  /**
   * Shared prompt context builder for allocation/risk inference requests.
   */
  public async buildRecommendationPromptMessages(
    options: Parameters<typeof buildAllocationRecommendationPromptMessages>[0],
  ) {
    return buildAllocationRecommendationPromptMessages(options);
  }

  /**
   * Shared realtime single-request inference for allocation/risk recommendation requests.
   */
  public async inferRecommendationsInRealtime<TItem, TResult>(options: {
    itemsByTargetSymbol: Map<string, TItem[]>;
    prompt: string;
    createRequestConfig: (maxItems: number) => ResponseCreateConfig;
    openaiService: Pick<OpenaiService, 'addMessage' | 'addPromptPair' | 'createResponse' | 'getResponseOutput'>;
    featureService: Pick<FeatureService, 'MARKET_DATA_LEGEND' | 'extractMarketFeatures' | 'formatMarketData'>;
    newsService: Pick<NewsService, 'getCompactNews'>;
    marketRegimeService: Pick<MarketRegimeService, 'getSnapshot'>;
    errorService: Pick<ErrorService, 'retryWithFallback'>;
    allocationAuditService: Pick<AllocationAuditService, 'buildAllocationValidationGuardrailText'>;
    onNewsError: (error: unknown) => void;
    onMarketRegimeError: (error: unknown) => void;
    onValidationGuardrailError: (error: unknown, symbol: string) => void;
    onUnexpectedSymbol: (args: { outputSymbol: string }) => void;
    onDuplicateSymbol: (args: { outputSymbol: string }) => void;
    onInferenceFailed: (error: unknown) => void;
    buildIncompleteResponseError: (args: { expectedCount: number; receivedCount: number }) => string;
    buildMissingResponseError: (args: { symbol: string }) => string;
    buildResult: (args: {
      item: TItem;
      targetSymbol: string;
      responseData: unknown;
      normalizedResponse: NormalizedAllocationRecommendationResponse | null;
      marketFeatures: MarketFeatures | null;
      marketRegime: MarketRegimeSnapshot | null;
      feargreed: Feargreed | null;
    }) => TResult | null;
  }): Promise<TResult[]> {
    try {
      return await options.errorService.retryWithFallback(
        () => this.executeRealtimeRecommendation(Array.from(options.itemsByTargetSymbol.keys()), options),
        {
          ...this.realtimeRecommendationRetryOptions,
          operationName: 'realtimeRecommendation',
          isNonRetryable: (error) => error instanceof RealtimeRecommendationResponseError,
        },
      );
    } catch (error) {
      options.onInferenceFailed(error);
      throw error;
    }
  }

  /**
   * Shared normalization for multi-symbol recommendation response payloads.
   */
  public normalizeRecommendationBatchResponsePayload(
    response: unknown,
    options: Parameters<typeof normalizeAllocationRecommendationBatchResponsePayload>[1],
  ) {
    return normalizeAllocationRecommendationBatchResponsePayload(response, options);
  }

  /**
   * Shared persistence path for allocation/risk recommendation batches.
   */
  public async persistAllocationRecommendationBatch(options: {
    recommendations: RecommendationResultDraft[];
    enqueueAllocationBatchValidation: (batchId: string) => Promise<void>;
    onEnqueueValidationError: (error: unknown) => void;
  }): Promise<AllocationRecommendationData[]> {
    const batchId = generateMonotonicUlid();
    const savedRecommendations = await Promise.all(
      options.recommendations.map((recommendation) =>
        this.saveAllocationRecommendation({ ...recommendation, batchId }),
      ),
    );

    void options.enqueueAllocationBatchValidation(batchId).catch(options.onEnqueueValidationError);

    return savedRecommendations.map((savedRecommendation, index) =>
      this.mapSavedAllocationRecommendation(savedRecommendation, options.recommendations[index]),
    );
  }

  private async executeRealtimeRecommendation<TItem, TResult>(
    symbols: string[],
    options: {
      itemsByTargetSymbol: Map<string, TItem[]>;
      prompt: string;
      createRequestConfig: (maxItems: number) => ResponseCreateConfig;
      openaiService: Pick<OpenaiService, 'addMessage' | 'addPromptPair' | 'createResponse' | 'getResponseOutput'>;
      featureService: Pick<FeatureService, 'MARKET_DATA_LEGEND' | 'extractMarketFeatures' | 'formatMarketData'>;
      newsService: Pick<NewsService, 'getCompactNews'>;
      marketRegimeService: Pick<MarketRegimeService, 'getSnapshot'>;
      errorService: Pick<ErrorService, 'retryWithFallback'>;
      allocationAuditService: Pick<AllocationAuditService, 'buildAllocationValidationGuardrailText'>;
      onNewsError: (error: unknown) => void;
      onMarketRegimeError: (error: unknown) => void;
      onValidationGuardrailError: (error: unknown, symbol: string) => void;
      onUnexpectedSymbol: (args: { outputSymbol: string }) => void;
      onDuplicateSymbol: (args: { outputSymbol: string }) => void;
      buildIncompleteResponseError: (args: { expectedCount: number; receivedCount: number }) => string;
      buildMissingResponseError: (args: { symbol: string }) => string;
      buildResult: (args: {
        item: TItem;
        targetSymbol: string;
        responseData: unknown;
        normalizedResponse: NormalizedAllocationRecommendationResponse | null;
        marketFeatures: MarketFeatures | null;
        marketRegime: MarketRegimeSnapshot | null;
        feargreed: Feargreed | null;
      }) => TResult | null;
    },
  ): Promise<TResult[]> {
    const { messages, marketFeaturesBySymbol, marketRegime, feargreed } = await this.buildRecommendationPromptMessages({
      symbols,
      prompt: options.prompt,
      openaiService: options.openaiService,
      featureService: options.featureService,
      newsService: options.newsService,
      marketRegimeService: options.marketRegimeService,
      errorService: options.errorService,
      allocationAuditService: options.allocationAuditService,
      onNewsError: options.onNewsError,
      onMarketRegimeError: options.onMarketRegimeError,
      onValidationGuardrailError: options.onValidationGuardrailError,
    });

    const response = await options.openaiService.createResponse(messages, options.createRequestConfig(symbols.length));
    const outputText = options.openaiService.getResponseOutput(response).text;
    if (!outputText || outputText.trim() === '') {
      throw new RealtimeRecommendationResponseError(
        `Empty multi-symbol recommendation response: requested ${symbols.length}`,
      );
    }

    let responseData: unknown;
    try {
      responseData = JSON.parse(outputText);
    } catch (error) {
      throw new RealtimeRecommendationResponseError('Invalid multi-symbol recommendation response JSON', {
        cause: error,
      });
    }
    const normalizedResponseBySymbol = this.normalizeRecommendationBatchResponsePayload(responseData, {
      expectedSymbols: symbols,
      onUnexpectedSymbol: options.onUnexpectedSymbol,
      onDuplicateSymbol: options.onDuplicateSymbol,
    });

    if (normalizedResponseBySymbol.size !== symbols.length) {
      throw new RealtimeRecommendationResponseError(
        options.buildIncompleteResponseError({
          expectedCount: symbols.length,
          receivedCount: normalizedResponseBySymbol.size,
        }),
      );
    }

    return symbols.flatMap((targetSymbol) => {
      const batchResult = normalizedResponseBySymbol.get(targetSymbol);
      if (!batchResult) {
        throw new RealtimeRecommendationResponseError(options.buildMissingResponseError({ symbol: targetSymbol }));
      }

      return (options.itemsByTargetSymbol.get(targetSymbol) ?? [])
        .map((item) =>
          options.buildResult({
            item,
            targetSymbol,
            responseData: batchResult.raw,
            normalizedResponse: batchResult.normalized,
            marketFeatures: marketFeaturesBySymbol.get(targetSymbol) ?? null,
            marketRegime,
            feargreed,
          }),
        )
        .filter((result): result is TResult => result != null);
    });
  }

  /**
   * Shared recommendation entity save path for allocation/risk flows.
   */
  public async saveAllocationRecommendation(
    recommendation: Omit<AllocationRecommendationData, 'id'> & Partial<Pick<AllocationRecommendationData, 'id'>>,
  ): Promise<AllocationRecommendation> {
    const normalizedSymbol =
      recommendation.category === Category.NASDAQ
        ? recommendation.symbol?.trim().toUpperCase()
        : normalizeKrwSymbol(recommendation.symbol);
    if (!normalizedSymbol) {
      throw new Error(`Invalid balance recommendation symbol: ${recommendation.symbol}`);
    }

    const allocationRecommendation = new AllocationRecommendation();
    Object.assign(allocationRecommendation, recommendation, { symbol: normalizedSymbol });
    allocationRecommendation.btcDominance = recommendation.btcDominance ?? null;
    allocationRecommendation.altcoinIndex = recommendation.altcoinIndex ?? null;
    allocationRecommendation.marketRegimeAsOf = recommendation.marketRegimeAsOf ?? null;
    allocationRecommendation.marketRegimeSource = recommendation.marketRegimeSource ?? null;
    allocationRecommendation.marketRegimeIsStale = recommendation.marketRegimeIsStale ?? null;
    allocationRecommendation.feargreedIndex = recommendation.feargreedIndex ?? null;
    allocationRecommendation.feargreedClassification = recommendation.feargreedClassification ?? null;
    allocationRecommendation.feargreedTimestamp = recommendation.feargreedTimestamp ?? null;
    allocationRecommendation.decisionConfidence = recommendation.decisionConfidence ?? null;
    allocationRecommendation.expectedVolatilityPct = recommendation.expectedVolatilityPct ?? null;
    allocationRecommendation.riskFlags = recommendation.riskFlags ?? null;
    allocationRecommendation.expectedEdgeRate = recommendation.expectedEdgeRate ?? null;
    allocationRecommendation.estimatedCostRate = recommendation.estimatedCostRate ?? null;
    allocationRecommendation.spreadRate = recommendation.spreadRate ?? null;
    allocationRecommendation.impactRate = recommendation.impactRate ?? null;
    return allocationRecommendation.save();
  }

  private mapSavedAllocationRecommendation(
    savedRecommendation: AllocationRecommendation,
    recommendation: RecommendationResultDraft,
  ): AllocationRecommendationData {
    return {
      id: savedRecommendation.id,
      batchId: savedRecommendation.batchId,
      symbol: savedRecommendation.symbol,
      category: savedRecommendation.category,
      intensity: savedRecommendation.intensity,
      prevIntensity: savedRecommendation.prevIntensity != null ? Number(savedRecommendation.prevIntensity) : null,
      prevModelTargetWeight: recommendation.prevModelTargetWeight ?? null,
      buyScore: savedRecommendation.buyScore,
      sellScore: savedRecommendation.sellScore,
      modelTargetWeight: savedRecommendation.modelTargetWeight,
      action: recommendation.action,
      reason: savedRecommendation.reason != null ? toUserFacingText(savedRecommendation.reason) : null,
      hasStock: recommendation.hasStock,
      weight: recommendation.weight,
      confidence: recommendation.confidence,
      decisionConfidence: recommendation.decisionConfidence,
      expectedVolatilityPct: recommendation.expectedVolatilityPct,
      riskFlags: recommendation.riskFlags,
      expectedEdgeRate: recommendation.expectedEdgeRate,
      estimatedCostRate: recommendation.estimatedCostRate,
      spreadRate: recommendation.spreadRate,
      impactRate: recommendation.impactRate,
      btcDominance: savedRecommendation.btcDominance,
      altcoinIndex: savedRecommendation.altcoinIndex,
      marketRegimeAsOf: savedRecommendation.marketRegimeAsOf,
      marketRegimeSource: savedRecommendation.marketRegimeSource,
      marketRegimeIsStale: savedRecommendation.marketRegimeIsStale,
      feargreedIndex: savedRecommendation.feargreedIndex,
      feargreedClassification: savedRecommendation.feargreedClassification,
      feargreedTimestamp: savedRecommendation.feargreedTimestamp,
    };
  }

  /**
   * Shared included recommendation filtering by policy thresholds.
   */
  public filterIncludedRecommendations(inferences: AllocationRecommendationData[]): AllocationRecommendationData[] {
    return filterIncludedRecommendationsByCategory(inferences, {
      minimumTradeIntensity: this.minimumTradeIntensity,
      minAllocationConfidence: this.defaultTradePolicy.minimumAllocationConfidence,
    });
  }

  /**
   * Shared excluded recommendation filtering by policy thresholds.
   */
  public filterExcludedRecommendations(inferences: AllocationRecommendationData[]): AllocationRecommendationData[] {
    return filterExcludedRecommendationsByCategory(inferences, {
      minimumTradeIntensity: this.minimumTradeIntensity,
      minAllocationConfidence: this.defaultTradePolicy.minimumAllocationConfidence,
    });
  }

  /**
   * Shared no-trade recommendation predicate by policy thresholds.
   */
  public isNoTradeRecommendation(inference: AllocationRecommendationData): boolean {
    return isNoTradeRecommendation(inference, this.defaultTradePolicy.minimumAllocationConfidence);
  }

  /**
   * Shared KRW market orderability predicate.
   */
  public isOrderableSymbol(symbol: string, orderableSymbols?: Set<string>): boolean {
    return isOrderableSymbol(symbol, orderableSymbols);
  }

  /**
   * Builds full-sell requests for holdings missing from latest inference output.
   */
  public buildMissingInferenceSellRequests(options: {
    balances: Balances;
    inferences: AllocationRecommendationData[];
    marketPrice: number;
    orderableSymbols?: Set<string>;
    tradableMarketValueMap?: Map<string, number>;
    triggerReason?: string;
  }): TradeRequest[] {
    const {
      balances,
      inferences,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
      triggerReason = 'missing_from_inference',
    } = options;
    const fullExitDiff = this.defaultTradePolicy.stagedExitFull;

    return balances.info
      .filter((item) => {
        const tradableBalance = parseFloat(item.balance || '0');
        const symbol = `${item.currency}/${item.unit_currency}`;

        return (
          item.currency !== item.unit_currency &&
          tradableBalance > 0 &&
          !inferences.some((inference) => inference.symbol === symbol) &&
          isOrderableSymbol(symbol, orderableSymbols) &&
          isSellAmountSufficient(
            symbol,
            fullExitDiff,
            this.defaultTradePolicy.minimumTradePrice,
            tradableMarketValueMap,
          )
        );
      })
      .map((item) => ({
        symbol: `${item.currency}/${item.unit_currency}`,
        diff: fullExitDiff,
        balances,
        marketPrice,
        executionUrgency: 'urgent' as const,
        triggerReason,
      }));
  }

  /**
   * Resolves category exposure cap used by allocation/risk sizing flows.
   */
  public resolveCategoryExposureCap(category: Category, categoryExposureCaps?: CategoryExposureCaps): number {
    if (!categoryExposureCaps) {
      return 1;
    }

    switch (category) {
      case Category.COIN_MAJOR:
        return clamp01(categoryExposureCaps.coinMajor);
      case Category.COIN_MINOR:
        return clamp01(categoryExposureCaps.coinMinor);
      case Category.NASDAQ:
        return clamp01(categoryExposureCaps.nasdaq);
      default:
        return 1;
    }
  }

  /**
   * Calculates category-capped target weight and returns commit callback for deferred cap consumption.
   */
  public allocateCategoryCappedTargetWeight(options: {
    category: Category;
    uncappedTargetWeight: number;
    categoryAllocatedTargetWeight: Map<Category, number>;
    categoryExposureCaps?: CategoryExposureCaps;
  }): { targetWeight: number; commit(): void } {
    const { category, uncappedTargetWeight, categoryAllocatedTargetWeight, categoryExposureCaps } = options;
    const categoryCap = this.resolveCategoryExposureCap(category, categoryExposureCaps);
    const allocatedCategoryWeight = categoryAllocatedTargetWeight.get(category) ?? 0;
    const remainingCategoryCap = Math.max(0, categoryCap - allocatedCategoryWeight);
    const targetWeight = clamp01(Math.min(uncappedTargetWeight, remainingCategoryCap));

    return {
      targetWeight,
      commit: () => {
        categoryAllocatedTargetWeight.set(category, allocatedCategoryWeight + targetWeight);
      },
    };
  }

  /**
   * Shared implementation for included rebalance trade request generation.
   */
  public buildIncludedTradeRequests(options: IncludedTradeRequestBuildOptions): TradeRequest[] {
    const {
      runtime,
      balances,
      candidates,
      targetSlotCount,
      regimeMultiplier,
      currentWeights,
      marketPrice,
      calculateTargetWeight,
      orderableSymbols,
      tradableMarketValueMap,
      rebalanceBandMultiplier = 1,
      categoryExposureCaps,
    } = options;
    const policy = this.resolveTradePolicy(options.policy);

    if (candidates.length === 0) {
      return [];
    }

    const convictionRows = candidates.map((inference) => {
      const baseTargetWeight = calculateTargetWeight(inference, regimeMultiplier);
      const conviction = Math.max(
        Number.EPSILON,
        baseTargetWeight * clamp01(inference.decisionConfidence ?? inference.confidence ?? 1),
      );

      return {
        inference,
        baseTargetWeight,
        conviction,
      };
    });
    const totalConviction = convictionRows.reduce((sum, row) => sum + row.conviction, 0);
    const targetSlotDenominator = Math.max(1, targetSlotCount ?? candidates.length);
    const targetBudget = clamp01(
      convictionRows.reduce((sum, row) => sum + row.baseTargetWeight, 0) / targetSlotDenominator,
    );
    const categoryAllocatedTargetWeight = new Map<Category, number>();

    return convictionRows
      .map(({ inference, baseTargetWeight, conviction }) => {
        if (!isOrderableSymbol(inference.symbol, orderableSymbols)) {
          return null;
        }

        const normalizedWeight = totalConviction > 0 ? conviction / totalConviction : baseTargetWeight;
        const uncappedTargetWeight = clamp01(normalizedWeight * targetBudget);
        const categoryTargetWeightAllocation = this.allocateCategoryCappedTargetWeight({
          category: inference.category,
          uncappedTargetWeight,
          categoryAllocatedTargetWeight,
          categoryExposureCaps,
        });
        const { targetWeight } = categoryTargetWeightAllocation;
        const currentWeight = currentWeights.get(inference.symbol) ?? 0;
        const deltaWeight = targetWeight - currentWeight;

        const minBand = policy.minimumAllocationBand * rebalanceBandMultiplier;
        const bandRatio = policy.allocationBandRatio * rebalanceBandMultiplier;
        if (!shouldReallocate(targetWeight, deltaWeight, minBand, bandRatio)) {
          runtime.logger.log(
            runtime.i18n.t('logging.inference.allocationRecommendation.skip_allocation_band', {
              args: {
                symbol: inference.symbol,
                targetWeight,
                currentWeight,
                deltaWeight,
                requiredBand: calculateAllocationBand(targetWeight, minBand, bandRatio),
              },
            }),
          );
          return null;
        }

        const expectedEdgeRate = this.resolveExpectedEdgeRate(deltaWeight, inference);
        const estimatedCostRate = this.resolveEstimatedCostRate(policy, inference);
        if (!this.passesExpectedEdgeGate(policy, expectedEdgeRate, estimatedCostRate)) {
          runtime.logger.log(
            runtime.i18n.t('logging.inference.allocationRecommendation.skip_cost_gate', {
              args: {
                symbol: inference.symbol,
                deltaWeight,
                expectedEdgeRate,
                estimatedCostRate,
                minEdge: estimatedCostRate + policy.edgeRiskBufferRate,
              },
            }),
          );
          return null;
        }

        const diff = calculateRelativeDiff(targetWeight, currentWeight);
        if (!Number.isFinite(diff) || Math.abs(diff) < Number.EPSILON) {
          return null;
        }
        const payoffOverlay = this.resolvePayoffOverlaySellDiff(policy, diff, inference);
        const adjustedDiff = payoffOverlay.diff;

        runtime.logger.log(
          runtime.i18n.t('logging.inference.allocationRecommendation.trade_delta', {
            args: {
              symbol: inference.symbol,
              targetWeight,
              currentWeight,
              deltaWeight,
              diff: adjustedDiff,
            },
          }),
        );

        if (
          adjustedDiff < 0 &&
          !isSellAmountSufficient(inference.symbol, adjustedDiff, policy.minimumTradePrice, tradableMarketValueMap)
        ) {
          return null;
        }

        // Deferred commit avoids consuming category budget for skipped candidates.
        categoryTargetWeightAllocation.commit();

        return {
          symbol: inference.symbol,
          diff: adjustedDiff,
          balances,
          marketPrice,
          // Store the selection inputs once so budget/ranking logic downstream does not have to
          // recompute them with slightly different assumptions.
          estimatedNotional: Math.max(0, Math.abs(deltaWeight) * marketPrice),
          currentWeight,
          targetWeight,
          deltaWeight,
          // Buy priority is based on the refreshed tradable notional, not the model's stale
          // hasStock flag. Dust-sized leftovers should not get incumbent priority.
          positionClass: this.resolveBuyPositionClass({
            diff: adjustedDiff,
            currentWeight,
            marketPrice,
            minimumTradePrice: policy.minimumTradePrice,
            tradableNotional: tradableMarketValueMap?.get(inference.symbol) ?? null,
          }),
          expectedNetEdge: expectedEdgeRate - estimatedCostRate,
          inference,
          expectedEdgeRate,
          estimatedCostRate,
          spreadRate: inference.spreadRate ?? null,
          impactRate: inference.impactRate ?? null,
          executionUrgency: adjustedDiff < 0 ? ('urgent' as const) : ('normal' as const),
          triggerReason: payoffOverlay.triggerReason ?? 'included_rebalance',
        };
      })
      .filter((item): item is Exclude<typeof item, null> => item !== null)
      .sort((a, b) => {
        const aSell = a.diff < 0;
        const bSell = b.diff < 0;
        if (aSell !== bSell) {
          return aSell ? -1 : 1;
        }
        if (aSell && bSell) {
          return a.diff - b.diff;
        }
        return b.diff - a.diff;
      });
  }

  /**
   * Shared implementation for staged-exit trade request generation.
   */
  public buildExcludedTradeRequests(options: ExcludedTradeRequestBuildOptions): TradeRequest[] {
    const { balances, candidates, marketPrice, orderableSymbols, tradableMarketValueMap } = options;
    const policy = this.resolveTradePolicy(options.policy);

    return candidates
      .filter(
        (inference) =>
          isOrderableSymbol(inference.symbol, orderableSymbols) &&
          isSellAmountSufficient(
            inference.symbol,
            this.resolveStagedExitDiff(policy, inference),
            policy.minimumTradePrice,
            tradableMarketValueMap,
          ),
      )
      .map((inference) => ({
        symbol: inference.symbol,
        diff: this.resolveStagedExitDiff(policy, inference),
        balances,
        marketPrice,
        inference,
        expectedEdgeRate: this.resolveExpectedEdgeRate(1, inference),
        estimatedCostRate: this.resolveEstimatedCostRate(policy, inference),
        spreadRate: inference.spreadRate ?? null,
        impactRate: inference.impactRate ?? null,
        executionUrgency: 'urgent' as const,
        triggerReason: 'excluded_staged_exit',
      }));
  }

  /**
   * Shared implementation for no-trade trim request generation.
   */
  public buildNoTradeTrimRequests(options: NoTradeTrimRequestBuildOptions): TradeRequest[] {
    const {
      runtime,
      balances,
      candidates,
      topK,
      regimeMultiplier,
      currentWeights,
      marketPrice,
      orderableSymbols,
      tradableMarketValueMap,
      rebalanceBandMultiplier = 1,
      categoryExposureCaps,
    } = options;
    const policy = this.resolveTradePolicy(options.policy);
    const normalizedTopK = Math.max(1, topK);
    const categoryAllocatedTargetWeight = new Map<Category, number>();

    return candidates
      .map((inference) => {
        if (!isOrderableSymbol(inference.symbol, orderableSymbols)) {
          runtime.logger.log(
            runtime.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: { symbol: inference.symbol, reason: 'not_orderable' },
            }),
          );
          return null;
        }

        if (inference.modelTargetWeight == null || !Number.isFinite(inference.modelTargetWeight)) {
          runtime.logger.log(
            runtime.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: { symbol: inference.symbol, reason: 'missing_target_weight' },
            }),
          );
          return null;
        }

        const baseTargetWeight = clamp01(inference.modelTargetWeight);
        // Hold actions recomputed in user scope already carry account-level weight.
        // Legacy no-trade/model targets remain pre-slot weights and require topK normalization.
        const uncappedTargetWeight =
          inference.action === 'hold'
            ? clamp01(baseTargetWeight * regimeMultiplier)
            : clamp01(baseTargetWeight * regimeMultiplier) / normalizedTopK;
        const categoryTargetWeightAllocation = this.allocateCategoryCappedTargetWeight({
          category: inference.category,
          uncappedTargetWeight,
          categoryAllocatedTargetWeight,
          categoryExposureCaps,
        });
        const { targetWeight } = categoryTargetWeightAllocation;
        const currentWeight = currentWeights.get(inference.symbol) ?? 0;
        const deltaWeight = targetWeight - currentWeight;
        if (deltaWeight >= 0) {
          runtime.logger.log(
            runtime.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: {
                symbol: inference.symbol,
                reason: 'not_overweight',
                targetWeight,
                currentWeight,
                deltaWeight,
              },
            }),
          );
          return null;
        }

        const minBand = policy.minimumAllocationBand * rebalanceBandMultiplier;
        const bandRatio = policy.allocationBandRatio * rebalanceBandMultiplier;
        if (!shouldReallocate(targetWeight, deltaWeight, minBand, bandRatio)) {
          runtime.logger.log(
            runtime.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: {
                symbol: inference.symbol,
                reason: 'allocation_band',
                targetWeight,
                currentWeight,
                deltaWeight,
                requiredBand: calculateAllocationBand(targetWeight, minBand, bandRatio),
              },
            }),
          );
          return null;
        }

        const expectedEdgeRate = this.resolveExpectedEdgeRate(deltaWeight, inference);
        const estimatedCostRate = this.resolveEstimatedCostRate(policy, inference);
        if (!this.passesExpectedEdgeGate(policy, expectedEdgeRate, estimatedCostRate)) {
          runtime.logger.log(
            runtime.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: {
                symbol: inference.symbol,
                reason: 'cost_gate',
                deltaWeight,
                expectedEdgeRate,
                estimatedCostRate,
                minEdge: estimatedCostRate + policy.edgeRiskBufferRate,
              },
            }),
          );
          return null;
        }

        const diff = calculateRelativeDiff(targetWeight, currentWeight);
        if (!Number.isFinite(diff) || diff >= 0 || Math.abs(diff) < Number.EPSILON) {
          runtime.logger.log(
            runtime.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: {
                symbol: inference.symbol,
                reason: 'invalid_diff',
                targetWeight,
                currentWeight,
                diff,
              },
            }),
          );
          return null;
        }

        const payoffOverlay = this.resolvePayoffOverlaySellDiff(policy, diff, inference);
        const adjustedDiff = payoffOverlay.diff;
        if (!isSellAmountSufficient(inference.symbol, adjustedDiff, policy.minimumTradePrice, tradableMarketValueMap)) {
          runtime.logger.log(
            runtime.i18n.t('logging.inference.allocationRecommendation.no_trade_trim_skipped', {
              args: {
                symbol: inference.symbol,
                reason: 'minimum_sell_amount',
                diff: adjustedDiff,
              },
            }),
          );
          return null;
        }

        runtime.logger.log(
          runtime.i18n.t('logging.inference.allocationRecommendation.no_trade_trim', {
            args: {
              symbol: inference.symbol,
              targetWeight,
              currentWeight,
              deltaWeight,
              diff: adjustedDiff,
            },
          }),
        );

        categoryTargetWeightAllocation.commit();
        return {
          symbol: inference.symbol,
          diff: adjustedDiff,
          balances,
          marketPrice,
          inference,
          expectedEdgeRate,
          estimatedCostRate,
          spreadRate: inference.spreadRate ?? null,
          impactRate: inference.impactRate ?? null,
          executionUrgency: 'urgent' as const,
          triggerReason: payoffOverlay.triggerReason ?? 'no_trade_trim',
        };
      })
      .filter((item): item is Exclude<typeof item, null> => item !== null)
      .sort((a, b) => a.diff - b.diff);
  }

  /**
   * Builds inferred holding items for ledger sync when no order is needed.
   * Keeps currently held inferred symbols so ledger stays in sync even when no order executes.
   */
  public buildInferredHoldingItems(options: BuildInferredHoldingItemsOptions): HoldingLedgerRemoveItem[] {
    const { candidates, currentWeights, orderableSymbols } = options;
    const uniqueCandidates = Array.from(
      new Map(candidates.map((inference) => [`${inference.symbol}:${inference.category}`, inference])).values(),
    );
    const inferredMap = new Map<string, HoldingLedgerRemoveItem>();

    const addWhenCurrentlyHeld = (inference: AllocationRecommendationData): void => {
      const currentWeight = currentWeights.get(inference.symbol) ?? 0;
      if (!Number.isFinite(currentWeight) || currentWeight <= Number.EPSILON) {
        return;
      }

      const key = `${inference.symbol}:${inference.category}`;
      inferredMap.set(key, {
        symbol: inference.symbol,
        category: inference.category,
      });
    };

    uniqueCandidates.forEach((inference) => {
      if (!isOrderableSymbol(inference.symbol, orderableSymbols)) {
        return;
      }
      addWhenCurrentlyHeld(inference);
    });

    return Array.from(inferredMap.values());
  }

  /**
   * Shared orderable symbol set resolver used by allocation/risk flows.
   */
  public async buildOrderableSymbolSet(
    symbols: string[],
    options: BuildOrderableSymbolSetOptions,
  ): Promise<Set<string> | undefined> {
    const targets = Array.from(new Set(symbols.filter((symbol) => symbol.endsWith('/KRW'))));
    if (targets.length < 1) {
      return new Set();
    }

    const checks = await Promise.all(
      targets.map(async (symbol) => {
        try {
          return {
            symbol,
            checked: true,
            exists: await options.isSymbolExist(symbol),
          };
        } catch {
          return { symbol, checked: false, exists: false };
        }
      }),
    );

    const checkedCount = checks.filter((check) => check.checked).length;
    if (checkedCount < 1) {
      options.onAllCheckFailed?.();
      return undefined;
    }

    if (checkedCount < checks.length) {
      options.onPartialCheck?.();
    }

    // Fail open for unchecked symbols so transient exchange errors do not freeze trading.
    return new Set(checks.filter((check) => !check.checked || check.exists).map((check) => check.symbol));
  }

  /**
   * Builds current holdings weight map from balances and holdings market value.
   */
  public async buildCurrentWeightMap(
    balances: Balances,
    totalMarketValue: number,
    getPrice: (symbol: string) => Promise<number>,
    orderableSymbols?: Set<string>,
    useTotalBalance = true,
  ): Promise<Map<string, number>> {
    const weightMap = new Map<string, number>();
    if (!Number.isFinite(totalMarketValue) || totalMarketValue <= 0) {
      return weightMap;
    }

    const weights = await Promise.all(
      balances.info
        .filter((item) => item.currency !== item.unit_currency)
        .map(async (item) => {
          const symbol = `${item.currency}/${item.unit_currency}`;
          const tradableBalance = parseFloat(item.balance || '0');
          const lockedBalance = parseFloat(item.locked || '0');
          const positionBalance = useTotalBalance ? tradableBalance + lockedBalance : tradableBalance;
          if (!Number.isFinite(positionBalance) || positionBalance <= 0) {
            return { symbol, weight: 0 };
          }
          if (!this.isOrderableSymbol(symbol, orderableSymbols)) {
            return { symbol, weight: 0 };
          }

          try {
            const currPrice = await getPrice(symbol);
            return { symbol, weight: (positionBalance * currPrice) / totalMarketValue };
          } catch {
            // Price API fallback: use avg_buy_price to keep weight estimation available.
            const avgBuyPrice = parseFloat(item.avg_buy_price || '0');
            if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) {
              return null;
            }
            return { symbol, weight: (positionBalance * avgBuyPrice) / totalMarketValue };
          }
        }),
    );

    for (const item of weights) {
      if (!item) {
        continue;
      }
      if (item.weight > 0) {
        weightMap.set(item.symbol, item.weight);
      }
    }

    return weightMap;
  }

  /**
   * Builds tradable market value map from balances.
   */
  public async buildTradableMarketValueMap(
    balances: Balances,
    getPrice: (symbol: string) => Promise<number>,
    orderableSymbols?: Set<string>,
  ): Promise<Map<string, number>> {
    const marketValueMap = new Map<string, number>();
    const values = await Promise.all(
      balances.info
        .filter((item) => item.currency !== item.unit_currency)
        .map(async (item) => {
          const symbol = `${item.currency}/${item.unit_currency}`;
          const tradableBalance = parseFloat(item.balance || '0');
          if (!Number.isFinite(tradableBalance) || tradableBalance <= 0) {
            return { symbol, marketValue: 0 };
          }
          if (!this.isOrderableSymbol(symbol, orderableSymbols)) {
            return { symbol, marketValue: 0 };
          }

          try {
            const currPrice = await getPrice(symbol);
            return { symbol, marketValue: tradableBalance * currPrice };
          } catch {
            // Keep best-effort tradable value map when live price fetch fails.
            const avgBuyPrice = parseFloat(item.avg_buy_price || '0');
            if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) {
              return { symbol, marketValue: 0 };
            }
            return { symbol, marketValue: tradableBalance * avgBuyPrice };
          }
        }),
    );

    for (const { symbol, marketValue } of values) {
      if (marketValue > 0) {
        marketValueMap.set(symbol, marketValue);
      }
    }

    return marketValueMap;
  }

  private async calculateHoldingsMarketValue(
    exchangeService: TradeRuntimeContext['exchangeService'],
    balances: Balances,
    orderableSymbols?: Set<string>,
  ): Promise<{ marketValue: number; useTotalBalance: boolean }> {
    const marketValueResolvers = exchangeService as TradeRuntimeContext['exchangeService'] & {
      calculateTotalMarketValue?: (balances: Balances, orderableSymbols?: Set<string>) => Promise<number>;
      calculateTradableMarketValue?: (balances: Balances, orderableSymbols?: Set<string>) => Promise<number>;
      calculateTotalPrice?: (balances: Balances) => number;
    };

    if (typeof marketValueResolvers.calculateTotalMarketValue === 'function') {
      return {
        marketValue: await marketValueResolvers.calculateTotalMarketValue.call(
          exchangeService,
          balances,
          orderableSymbols,
        ),
        useTotalBalance: true,
      };
    }

    if (typeof marketValueResolvers.calculateTradableMarketValue === 'function') {
      // Keep denominator/numerator basis consistent when only tradable market value API is available.
      return {
        marketValue: await marketValueResolvers.calculateTradableMarketValue.call(
          exchangeService,
          balances,
          orderableSymbols,
        ),
        useTotalBalance: false,
      };
    }

    if (typeof marketValueResolvers.calculateTotalPrice === 'function') {
      // Legacy fallback for partial mocks/tests that expose only total-price estimator.
      const marketValue = marketValueResolvers.calculateTotalPrice.call(exchangeService, balances);
      return {
        marketValue: Number.isFinite(marketValue) && marketValue > 0 ? marketValue : 0,
        useTotalBalance: false,
      };
    }

    // Defensive fallback for incomplete runtime mocks; avoids hard failure in orchestration tests.
    return {
      marketValue: 0,
      useTotalBalance: false,
    };
  }

  /**
   * Builds a reusable market snapshot for both sell and buy orchestration steps.
   */
  public async buildTradeExecutionSnapshot(
    options: BuildTradeExecutionSnapshotOptions,
  ): Promise<TradeExecutionSnapshot> {
    const { runtime, balances, referenceSymbols, assertLockOrThrow = () => undefined } = options;

    const orderableSymbols = await this.buildOrderableSymbolSet(
      [...referenceSymbols, ...balances.info.map((item) => `${item.currency}/${item.unit_currency}`)],
      {
        isSymbolExist: (symbol) => runtime.exchangeService.isSymbolExist(symbol),
        onAllCheckFailed: () =>
          runtime.logger.warn(
            runtime.i18n.t('logging.inference.allocationRecommendation.orderable_symbol_check_failed'),
          ),
        onPartialCheck: () =>
          runtime.logger.warn(
            runtime.i18n.t('logging.inference.allocationRecommendation.orderable_symbol_check_partial'),
          ),
      },
    );
    assertLockOrThrow();

    const { marketValue: marketPrice, useTotalBalance } = await this.calculateHoldingsMarketValue(
      runtime.exchangeService,
      balances,
      orderableSymbols,
    );
    assertLockOrThrow();

    const currentWeights = await this.buildCurrentWeightMap(
      balances,
      marketPrice,
      (symbol) => runtime.exchangeService.getPrice(symbol),
      orderableSymbols,
      useTotalBalance,
    );
    assertLockOrThrow();

    const tradableMarketValueMap = await this.buildTradableMarketValueMap(
      balances,
      (symbol) => runtime.exchangeService.getPrice(symbol),
      orderableSymbols,
    );
    assertLockOrThrow();

    return {
      balances,
      orderableSymbols,
      marketPrice,
      currentWeights,
      tradableMarketValueMap,
    };
  }

  /**
   * Executes the shared sell-first/buy-second rebalance workflow and syncs holding ledger.
   * @param options - Runtime/context builders and request factories for the rebalance run.
   * @returns Persisted trade list executed during this rebalance run.
   */
  public async executeRebalanceTrades(options: ExecuteRebalanceTradesOptions): Promise<Trade[]> {
    const {
      runtime,
      holdingLedgerService,
      notifyService,
      user,
      referenceSymbols,
      initialSnapshot,
      turnoverCap,
      additionalSellRequests = [],
      assertLockOrThrow = () => undefined,
      buildExcludedRequests,
      buildIncludedRequests,
      buildNoTradeTrimRequests,
      buildInferredHoldingItems,
    } = options;
    const policy = this.resolveTradePolicy(options.policy);

    const excludedTradeRequests = buildExcludedRequests(initialSnapshot);
    const includedTradeRequests = buildIncludedRequests(initialSnapshot);
    const noTradeTrimRequests = buildNoTradeTrimRequests(initialSnapshot);
    const includedSellRequests = includedTradeRequests.filter((item) => item.diff < 0);
    const rawSellRequests = [
      ...additionalSellRequests,
      ...excludedTradeRequests,
      ...includedSellRequests,
      ...noTradeTrimRequests,
    ].map((request) =>
      this.enrichRequestEstimatedNotional(
        request,
        initialSnapshot.tradableMarketValueMap,
        initialSnapshot.marketPrice,
        initialSnapshot.currentWeights,
      ),
    );
    const forcedFullLiquidationSellRequests = rawSellRequests.filter((request) => request.diff <= -1 + Number.EPSILON);
    const cappedSellCandidates = rawSellRequests.filter((request) => request.diff > -1 + Number.EPSILON);
    // Sell turnover is now capped by notional budget, not by request count.
    const sellBudgetResult = applyNotionalBudgetToRankedRequests(cappedSellCandidates, {
      budgetNotional:
        cappedSellCandidates.reduce((sum, request) => sum + Math.max(0, request.estimatedNotional ?? 0), 0) *
        turnoverCap,
      minimumTradePrice: policy.minimumTradePrice,
    });
    const sellRequests = [...forcedFullLiquidationSellRequests, ...sellBudgetResult.selectedRequests];

    if (
      sellBudgetResult.selectedRequests.length !== cappedSellCandidates.length ||
      sellBudgetResult.partialScaledRequest != null
    ) {
      runtime.logger.log(
        runtime.i18n.t('logging.inference.allocationRecommendation.sell_turnover_budget_applied', {
          args: this.buildTurnoverBudgetSummary(
            cappedSellCandidates,
            sellBudgetResult.selectedRequests,
            turnoverCap,
            sellBudgetResult.partialScaledRequest,
          ),
        }),
      );
    }

    const sellExecutions = await executeTradesSequentiallyWithRequests(
      sellRequests,
      (request) =>
        this.executeTrade({
          runtime,
          user,
          request,
        }),
      assertLockOrThrow,
    );
    assertLockOrThrow();
    const sellTrades = sellExecutions.map((execution) => execution.trade).filter((item): item is Trade => !!item);

    // Refresh balances after sells so buy sizing uses post-liquidation KRW.
    const refreshedBalances = await runtime.exchangeService.getBalances(user);
    assertLockOrThrow();

    let buyExecutions: Array<{ request: TradeRequest; trade: Trade | null }> = [];
    let inferredHoldingSnapshot = initialSnapshot;
    if (refreshedBalances) {
      const refreshedSnapshot = await this.buildTradeExecutionSnapshot({
        runtime,
        balances: refreshedBalances,
        referenceSymbols,
        assertLockOrThrow,
      });
      inferredHoldingSnapshot = refreshedSnapshot;
      const refreshedIncludedRequests = buildIncludedRequests(refreshedSnapshot);
      const buyRequests = refreshedIncludedRequests.filter((item) => item.diff > 0);
      const availableKrw = resolveAvailableKrwBalance(refreshedBalances);
      // First fit the candidate set into real post-sell KRW, then apply turnover budget to that
      // feasible set. This keeps "cash budget" and "turnover budget" as two separate steps.
      const scaledBuyRequests = scaleBuyRequestsToAvailableKrw(buyRequests, availableKrw, {
        tradableMarketValueMap: refreshedSnapshot.tradableMarketValueMap,
        fallbackMarketPrice: refreshedSnapshot.marketPrice,
        minimumTradePrice: policy.minimumTradePrice,
        onBudgetInsufficient: ({ availableKrw: targetAvailableKrw, totalEstimated, requestedCount }) => {
          runtime.logger.log(
            runtime.i18n.t('logging.inference.allocationRecommendation.buy_budget_insufficient', {
              args: {
                availableKrw: targetAvailableKrw,
                totalEstimated,
                requestedCount,
              },
            }),
          );
        },
        onBudgetScaled: ({ availableKrw: targetAvailableKrw, totalEstimated, scale, requestedCount }) => {
          runtime.logger.log(
            runtime.i18n.t('logging.inference.allocationRecommendation.buy_budget_scaled', {
              args: {
                availableKrw: targetAvailableKrw,
                totalEstimated,
                scale,
                requestedCount,
              },
            }),
          );
        },
      });
      // New entries no longer bypass turnover control. Every buy request competes under one
      // ranked notional budget.
      const prioritizedBuyRequests = [...scaledBuyRequests]
        .map((request) =>
          this.enrichRequestEstimatedNotional(
            request,
            refreshedSnapshot.tradableMarketValueMap,
            refreshedSnapshot.marketPrice,
            refreshedSnapshot.currentWeights,
          ),
        )
        .sort((a, b) => this.compareBuyRequestPriority(a, b));
      const buyBudgetResult = applyNotionalBudgetToRankedRequests(prioritizedBuyRequests, {
        budgetNotional:
          prioritizedBuyRequests.reduce((sum, request) => sum + Math.max(0, request.estimatedNotional ?? 0), 0) *
          turnoverCap,
        minimumTradePrice: policy.minimumTradePrice,
      });
      const cappedBuyRequests = buyBudgetResult.selectedRequests;
      if (cappedBuyRequests.length !== prioritizedBuyRequests.length || buyBudgetResult.partialScaledRequest != null) {
        runtime.logger.log(
          runtime.i18n.t('logging.inference.allocationRecommendation.buy_turnover_budget_applied', {
            args: this.buildTurnoverBudgetSummary(
              prioritizedBuyRequests,
              cappedBuyRequests,
              turnoverCap,
              buyBudgetResult.partialScaledRequest,
            ),
          }),
        );
      }
      buyExecutions = await executeTradesSequentiallyWithRequests(
        cappedBuyRequests,
        (request) =>
          this.executeTrade({
            runtime,
            user,
            request,
          }),
        assertLockOrThrow,
      );
      assertLockOrThrow();
    }

    const buyTrades = buyExecutions.map((execution) => execution.trade).filter((item): item is Trade => !!item);
    const existingHoldings = await holdingLedgerService.fetchHoldingsByUser(user);
    assertLockOrThrow();
    const liquidatedItems = this.collectLiquidatedHoldingItems(sellExecutions, OrderTypes.SELL, existingHoldings);
    const executedBuyItems = this.collectExecutedBuyHoldingItems(buyExecutions, OrderTypes.BUY);
    // Inferred holdings should reflect the post-sell account snapshot so fully liquidated names
    // are not reintroduced into the ledger just because they existed in the initial snapshot.
    const inferredHoldItems = buildInferredHoldingItems?.(inferredHoldingSnapshot) ?? [];
    // Holding ledger is replaced from execution result to keep category/symbol pairs canonical.
    await holdingLedgerService.replaceHoldingsForUser(
      user,
      this.buildMergedHoldingsForSave(existingHoldings, liquidatedItems, executedBuyItems, inferredHoldItems),
    );
    assertLockOrThrow();

    const allTrades: Trade[] = [...sellTrades, ...buyTrades];
    if (allTrades.length > 0) {
      await notifyService.notify(
        user,
        runtime.i18n.t('notify.order.result', {
          args: {
            transactions: allTrades
              .map((trade) =>
                runtime.i18n.t('notify.order.transaction', {
                  args: {
                    symbol: trade.symbol,
                    type: runtime.i18n.t(`label.order.type.${trade.type}`),
                    amount: formatNumber(trade.amount),
                    profit: formatNumber(trade.profit),
                    expectedEdgeRate: formatPercent(trade.expectedEdgeRate),
                    estimatedCostRate: formatPercent(trade.estimatedCostRate),
                    spreadRate: formatPercent(trade.spreadRate),
                    impactRate: formatPercent(trade.impactRate),
                    triggerReason: this.resolveTradeTriggerReasonLabel(runtime.i18n, trade.triggerReason),
                    gateBypassedReason: this.resolveTradeGateBypassedReasonLabel(
                      runtime.i18n,
                      trade.gateBypassedReason,
                    ),
                  },
                }),
              )
              .join('\n'),
          },
        }),
      );
      assertLockOrThrow();
    }

    runtime.exchangeService.clearClients();
    notifyService.clearClients();

    return allTrades;
  }

  /**
   * Resolves caller policy override or falls back to the shared default policy.
   */
  private resolveTradePolicy(policy?: TradePolicyConfig): TradePolicyConfig {
    return policy ?? this.defaultTradePolicy;
  }

  /**
   * Resolves localized trigger reason label for order notification payloads.
   */
  private resolveTradeTriggerReasonLabel(i18n: TradeRuntimeContext['i18n'], triggerReason?: string | null): string {
    return this.resolveTradeReasonLabel(i18n, 'triggerReasons', triggerReason);
  }

  /**
   * Resolves localized gate-bypass reason label for order notification payloads.
   */
  private resolveTradeGateBypassedReasonLabel(
    i18n: TradeRuntimeContext['i18n'],
    gateBypassedReason?: string | null,
  ): string {
    return this.resolveTradeReasonLabel(i18n, 'gateBypassedReasons', gateBypassedReason);
  }

  /**
   * Translates reason code and falls back to raw code when translation key is absent.
   */
  private resolveTradeReasonLabel(
    i18n: TradeRuntimeContext['i18n'],
    reasonType: 'triggerReasons' | 'gateBypassedReasons',
    reason?: string | null,
  ): string {
    if (!reason) {
      return '-';
    }

    const key = `label.trade.${reasonType}.${reason}`;
    const translated = i18n.t(key);
    if (typeof translated !== 'string' || translated === key) {
      return reason;
    }

    return translated;
  }

  private enrichRequestEstimatedNotional(
    request: TradeRequest,
    tradableMarketValueMap?: Map<string, number>,
    fallbackMarketPrice?: number,
    currentWeights?: Map<string, number>,
  ): TradeRequest {
    const fallbackRequest = {
      ...request,
      marketPrice:
        request.marketPrice != null && Number.isFinite(request.marketPrice) && request.marketPrice > 0
          ? request.marketPrice
          : fallbackMarketPrice,
      currentWeight:
        request.currentWeight != null && Number.isFinite(request.currentWeight)
          ? request.currentWeight
          : currentWeights?.get(request.symbol),
    };
    const symbolNotionalFallback =
      fallbackRequest.currentWeight != null &&
      Number.isFinite(fallbackRequest.currentWeight) &&
      fallbackRequest.marketPrice != null &&
      Number.isFinite(fallbackRequest.marketPrice)
        ? fallbackRequest.currentWeight * fallbackRequest.marketPrice
        : fallbackMarketPrice;
    const estimatedNotional = estimateTradeNotionalFromRequest(
      fallbackRequest,
      tradableMarketValueMap,
      symbolNotionalFallback,
    );
    return {
      ...fallbackRequest,
      estimatedNotional,
    };
  }

  private resolveBuyPositionClass(options: {
    diff: number;
    currentWeight?: number | null;
    marketPrice?: number | null;
    minimumTradePrice: number;
    tradableNotional?: number | null;
  }): 'existing' | 'new' {
    if (!(Number.isFinite(options.diff) && options.diff > 0)) {
      return 'new';
    }

    const currentHoldingNotional =
      options.currentWeight != null &&
      Number.isFinite(options.currentWeight) &&
      options.marketPrice != null &&
      Number.isFinite(options.marketPrice)
        ? options.currentWeight * options.marketPrice
        : 0;
    if (currentHoldingNotional >= options.minimumTradePrice) {
      return 'existing';
    }

    if (options.tradableNotional != null && Number.isFinite(options.tradableNotional)) {
      return options.tradableNotional >= options.minimumTradePrice ? 'existing' : 'new';
    }

    return 'new';
  }

  private compareBuyRequestPriority(a: TradeRequest, b: TradeRequest): number {
    // Keep incumbent resizing ahead of fresh entries before comparing reward/cost metrics.
    const aExisting = a.positionClass === 'existing';
    const bExisting = b.positionClass === 'existing';
    if (aExisting !== bExisting) {
      return aExisting ? -1 : 1;
    }

    const aExpectedNetEdge = a.expectedNetEdge ?? Number.NEGATIVE_INFINITY;
    const bExpectedNetEdge = b.expectedNetEdge ?? Number.NEGATIVE_INFINITY;
    if (aExpectedNetEdge !== bExpectedNetEdge) {
      return bExpectedNetEdge - aExpectedNetEdge;
    }

    const aDeltaWeight = Math.abs(a.deltaWeight ?? 0);
    const bDeltaWeight = Math.abs(b.deltaWeight ?? 0);
    if (aDeltaWeight !== bDeltaWeight) {
      return bDeltaWeight - aDeltaWeight;
    }

    if (a.diff !== b.diff) {
      return b.diff - a.diff;
    }

    return a.symbol.localeCompare(b.symbol);
  }

  private buildTurnoverBudgetSummary(
    requests: TradeRequest[],
    selectedRequests: TradeRequest[],
    turnoverCap: number,
    partialScaledRequest: TradeRequest | null,
  ): {
    turnoverCap: number;
    requestedCount: number;
    requestedNotional: number;
    budgetNotional: number;
    selectedCount: number;
    selectedNotional: number;
    selectedSymbols: string;
    skippedSymbols: string;
    partialScaledSymbol: string;
  } {
    // This summary feeds logs so operators can see the requested notional, the effective budget,
    // and whether the last selected request had to be partially scaled.
    const requestedNotional = requests.reduce((sum, request) => sum + Math.max(0, request.estimatedNotional ?? 0), 0);
    const selectedNotional = selectedRequests.reduce(
      (sum, request) => sum + Math.max(0, request.estimatedNotional ?? 0),
      0,
    );
    return {
      turnoverCap,
      requestedCount: requests.length,
      requestedNotional,
      budgetNotional: requestedNotional * turnoverCap,
      selectedCount: selectedRequests.length,
      selectedNotional,
      selectedSymbols: selectedRequests.map((request) => request.symbol).join(','),
      skippedSymbols: requests
        .filter((request) => !selectedRequests.some((selectedRequest) => selectedRequest.symbol === request.symbol))
        .map((request) => request.symbol)
        .join(','),
      partialScaledSymbol: partialScaledRequest?.symbol ?? '',
    };
  }

  /**
   * Shared trade execution/persistence path used by allocation and risk services.
   */
  public async executeTrade(options: ExecuteTradeOptions): Promise<Trade | null> {
    const { runtime, user, request } = options;

    runtime.logger.log(runtime.i18n.t('logging.trade.start', { args: { id: user.id, symbol: request.symbol } }));

    const adjustedOrderResponse = await runtime.exchangeService.adjustOrder(user, request);
    const adjustedOrder = this.normalizeAdjustedOrder(adjustedOrderResponse, request);
    const order = adjustedOrder.order;

    if (!order) {
      runtime.logger.log(runtime.i18n.t('logging.trade.not_exist', { args: { id: user.id, symbol: request.symbol } }));
      return null;
    }

    runtime.logger.log(
      runtime.i18n.t('logging.trade.calculate.start', { args: { id: user.id, symbol: request.symbol } }),
    );

    let executionOrder = order;
    let type = runtime.exchangeService.getOrderType(executionOrder);
    let orderStatus = typeof executionOrder.status === 'string' ? executionOrder.status : null;
    let requestedVolume =
      this.normalizeNonNegativeNumber(adjustedOrder.requestedVolume) ??
      this.normalizeNonNegativeNumber(executionOrder.amount);
    let filledVolume =
      this.normalizeNonNegativeNumber(adjustedOrder.filledVolume) ??
      this.normalizeNonNegativeNumber(executionOrder.filled);
    let { requestedAmount, filledAmount, hasExecutedFill } = await this.resolveTradeExecutionFillMetrics({
      adjustedRequestedAmount: adjustedOrder.requestedAmount,
      requestRequestedAmount: request.requestedAmount,
      adjustedFilledAmount: adjustedOrder.filledAmount,
      orderStatus,
      resolveFallbackFilledAmount: async () => runtime.exchangeService.calculateAmount(executionOrder),
    });
    const expectedEdgeRate = adjustedOrder.expectedEdgeRate ?? request.expectedEdgeRate ?? null;
    let resolvedAveragePrice = adjustedOrder.averagePrice ?? this.resolveAveragePriceFromOrder(order);

    if (
      !hasExecutedFill &&
      typeof runtime.exchangeService.fetchOrder === 'function' &&
      this.shouldAttemptMarketOrderReconcile(orderStatus, executionOrder)
    ) {
      const orderId = this.resolvePrimaryOrderId(executionOrder);
      if (orderId) {
        const reconciled = await this.reconcileOpenMarketOrderFillMetrics({
          runtime,
          user,
          symbol: request.symbol,
          orderId,
          adjustedRequestedAmount: adjustedOrder.requestedAmount,
          requestRequestedAmount: request.requestedAmount,
          requestedAmount,
          requestedVolume,
          filledVolume,
        });

        if (reconciled) {
          executionOrder = reconciled.executionOrder;
          type = runtime.exchangeService.getOrderType(executionOrder);
          orderStatus = reconciled.orderStatus;
          requestedAmount = reconciled.requestedAmount;
          filledAmount = reconciled.filledAmount;
          hasExecutedFill = reconciled.hasExecutedFill;
          requestedVolume = reconciled.requestedVolume;
          filledVolume = reconciled.filledVolume;
          resolvedAveragePrice = this.resolveAveragePriceFromOrder(executionOrder) ?? resolvedAveragePrice;
        }
      }
    }

    if (!hasExecutedFill) {
      runtime.logger.log(
        runtime.i18n.t('logging.trade.not_exist', {
          args: { id: user.id, symbol: request.symbol },
        }),
      );
      return null;
    }

    if (requestedVolume == null) {
      requestedVolume = this.normalizeNonNegativeNumber(executionOrder.amount);
    }
    if (filledVolume == null || filledVolume <= Number.EPSILON) {
      const directFilledVolume = this.normalizeNonNegativeNumber(executionOrder.filled);
      if (directFilledVolume != null && directFilledVolume > Number.EPSILON) {
        filledVolume = directFilledVolume;
      } else if (
        resolvedAveragePrice != null &&
        resolvedAveragePrice > Number.EPSILON &&
        Number.isFinite(filledAmount) &&
        filledAmount > Number.EPSILON
      ) {
        filledVolume = filledAmount / resolvedAveragePrice;
      } else if (
        this.isFinalizedOrderStatus(orderStatus) &&
        requestedVolume != null &&
        requestedVolume > Number.EPSILON
      ) {
        filledVolume = requestedVolume;
      }
    }

    const amount = filledAmount;
    const profit = await runtime.exchangeService.calculateProfit(request.balances, executionOrder, amount);

    // Estimate unrealized edge lost by partial fill (for post-trade diagnostics only).
    const missingRequestedAmount =
      requestedAmount != null && requestedAmount > filledAmount ? requestedAmount - filledAmount : 0;
    const missedOpportunityCost =
      requestedAmount != null &&
      requestedAmount > 0 &&
      expectedEdgeRate != null &&
      Number.isFinite(expectedEdgeRate) &&
      missingRequestedAmount > Number.EPSILON
        ? missingRequestedAmount * expectedEdgeRate
        : null;

    runtime.logger.log(
      runtime.i18n.t('logging.trade.calculate.end', {
        args: {
          id: user.id,
          symbol: request.symbol,
          type: runtime.i18n.t(`label.order.type.${type}`),
          amount,
          profit,
        },
      }),
    );

    runtime.logger.log(runtime.i18n.t('logging.trade.save.start', { args: { id: user.id, symbol: request.symbol } }));

    const trade = await this.saveTrade(user, {
      symbol: request.symbol,
      type,
      amount,
      profit,
      inference: request.inference,
      requestPrice: adjustedOrder.requestPrice ?? request.requestPrice ?? null,
      averagePrice: resolvedAveragePrice,
      requestedAmount,
      requestedVolume,
      filledAmount,
      filledVolume,
      expectedEdgeRate,
      estimatedCostRate: adjustedOrder.estimatedCostRate ?? request.estimatedCostRate ?? null,
      spreadRate: adjustedOrder.spreadRate ?? request.spreadRate ?? null,
      impactRate: adjustedOrder.impactRate ?? request.impactRate ?? null,
      missedOpportunityCost,
      gateBypassedReason: adjustedOrder.gateBypassedReason ?? request.gateBypassedReason ?? null,
      triggerReason: adjustedOrder.triggerReason ?? request.triggerReason ?? null,
    });

    runtime.logger.log(runtime.i18n.t('logging.trade.save.end', { args: { id: user.id, symbol: request.symbol } }));
    return trade;
  }

  /**
   * Persists a trade entity shared by allocation/risk trade execution paths.
   */
  private async saveTrade(user: User, data: TradeData): Promise<Trade> {
    const trade = new Trade();

    Object.assign(trade, data);
    trade.user = user;

    return trade.save();
  }

  /**
   * Converts recommendation confidence/action into staged sell intensity.
   * @param policy - Effective trade policy for the current run.
   * @param inference - Recommendation payload used to determine staged exit strength.
   * @returns Relative sell diff for staged exits.
   */
  private resolveStagedExitDiff(policy: TradePolicyConfig, inference?: AllocationRecommendationData): number {
    if (!inference) {
      return policy.stagedExitMedium;
    }

    const decisionConfidence = clamp01(inference.decisionConfidence ?? inference.confidence ?? 0.5);
    if (inference.action === 'sell' && decisionConfidence >= 0.6) {
      return policy.stagedExitFull;
    }
    if (inference.action === 'hold' || inference.action === 'no_trade') {
      return policy.stagedExitLight;
    }
    if (decisionConfidence < policy.minimumAllocationConfidence) {
      return policy.stagedExitLight;
    }

    return policy.stagedExitMedium;
  }

  /**
   * Resolves expected edge value used by cost-gate checks.
   * @param deltaWeight - Target minus current weight.
   * @param inference - Optional recommendation telemetry.
   * @returns Expected edge rate in [0, 1].
   */
  private resolveExpectedEdgeRate(deltaWeight: number, inference?: AllocationRecommendationData): number {
    const normalizedEdge = clamp01(Math.abs(deltaWeight));
    const conviction = clamp01(inference?.decisionConfidence ?? inference?.confidence ?? 1);
    const inferredEdge = normalizedEdge * conviction;

    if (inference?.expectedEdgeRate != null && Number.isFinite(inference.expectedEdgeRate)) {
      return Math.max(0, inference.expectedEdgeRate);
    }

    return inferredEdge;
  }

  /**
   * Resolves estimated execution cost rate.
   * @param policy - Effective trade policy for the current run.
   * @param inference - Optional recommendation telemetry.
   * @returns Estimated execution cost rate.
   */
  private resolveEstimatedCostRate(policy: TradePolicyConfig, inference?: AllocationRecommendationData): number {
    if (inference?.estimatedCostRate != null && Number.isFinite(inference.estimatedCostRate)) {
      return Math.max(0, inference.estimatedCostRate);
    }

    return policy.estimatedFeeRate + policy.estimatedSlippageRate;
  }

  /**
   * Checks whether expected edge clears cost + risk buffer threshold.
   * @param policy - Effective trade policy for the current run.
   * @param expectedEdgeRate - Expected edge rate.
   * @param estimatedCostRate - Estimated execution cost rate.
   * @returns `true` when trade payoff is large enough to execute.
   */
  private passesExpectedEdgeGate(
    policy: TradePolicyConfig,
    expectedEdgeRate: number,
    estimatedCostRate: number,
  ): boolean {
    return expectedEdgeRate > estimatedCostRate + policy.edgeRiskBufferRate;
  }

  /**
   * Applies defensive sell overlays on top of base diff.
   * @param policy - Effective trade policy for the current run.
   * @param diff - Base relative diff.
   * @param inference - Optional recommendation telemetry.
   * @returns Adjusted diff and optional trigger reason for telemetry.
   */
  private resolvePayoffOverlaySellDiff(
    policy: TradePolicyConfig,
    diff: number,
    inference?: AllocationRecommendationData,
  ): PayoffOverlayResult {
    if (!inference || diff >= 0) {
      return { diff, triggerReason: null };
    }

    const expectedVolatilityRate = this.normalizeExpectedVolatilityRate(inference.expectedVolatilityPct);
    const decisionConfidence = clamp01(inference.decisionConfidence ?? inference.confidence ?? 0.5);
    const sellScore = clamp01(inference.sellScore ?? 0);
    const buyScore = clamp01(inference.buyScore ?? 0);
    const previousTarget = clamp01(inference.prevModelTargetWeight ?? 0);
    const currentTarget = clamp01(inference.modelTargetWeight ?? 0);

    if (sellScore >= 0.75 && expectedVolatilityRate >= 0.03) {
      const stopLossFloor = Math.max(policy.payoffOverlayStopLossMin, -Math.min(1, expectedVolatilityRate * 4));
      return {
        diff: Math.min(diff, stopLossFloor),
        triggerReason: 'volatility_stop_loss',
      };
    }

    if (previousTarget > 0 && currentTarget < previousTarget && buyScore < 0.35 && decisionConfidence >= 0.4) {
      const trailingFloor = Math.max(policy.payoffOverlayTrailingMin, -Math.min(0.8, previousTarget - currentTarget));
      return {
        diff: Math.min(diff, trailingFloor),
        triggerReason: 'trailing_take_profit',
      };
    }

    return { diff, triggerReason: null };
  }

  /**
   * Normalizes expected volatility to 0-1 rate.
   * Supports both percentage-point and rate inputs.
   * @param expectedVolatilityPct - Volatility value in percentage-point or rate scale.
   * @returns Normalized volatility rate in 0-1 range.
   */
  private normalizeExpectedVolatilityRate(expectedVolatilityPct: number | null | undefined): number {
    if (expectedVolatilityPct == null || !Number.isFinite(expectedVolatilityPct)) {
      return 0;
    }

    const asRate = Math.abs(expectedVolatilityPct) > 1 ? expectedVolatilityPct / 100 : expectedVolatilityPct;
    return clamp01(Math.max(0, asRate));
  }

  /**
   * Normalizes raw order payload into adjusted-order shape used by persistence logic.
   * @param adjustedOrderResponse - Exchange response payload (legacy or adjusted).
   * @param request - Original trade request payload.
   * @returns Normalized adjusted-order result.
   */
  private normalizeAdjustedOrder(
    adjustedOrderResponse: AdjustedOrderResult | Order | null,
    request: TradeRequest,
  ): AdjustedOrderResult {
    if (this.isAdjustedOrderResult(adjustedOrderResponse)) {
      return adjustedOrderResponse;
    }

    return {
      order: (adjustedOrderResponse as Order | null) ?? null,
      requestPrice: request.requestPrice ?? null,
      requestedAmount: request.requestedAmount ?? null,
      requestedVolume: null,
      filledAmount: null,
      filledVolume: null,
      averagePrice: null,
      expectedEdgeRate: request.expectedEdgeRate ?? null,
      estimatedCostRate: request.estimatedCostRate ?? null,
      spreadRate: request.spreadRate ?? null,
      impactRate: request.impactRate ?? null,
      gateBypassedReason: request.gateBypassedReason ?? null,
      triggerReason: request.triggerReason ?? null,
    };
  }

  /**
   * Runtime type guard for adjusted-order payload from exchange service.
   * @param value - Unknown payload to validate.
   * @returns `true` when payload has adjusted-order shape.
   */
  private isAdjustedOrderResult(value: unknown): value is AdjustedOrderResult {
    return Boolean(value && typeof value === 'object' && 'order' in value && 'requestedAmount' in value);
  }

  /**
   * Resolves normalized execution fill metrics for persisted trades.
   */
  private async resolveTradeExecutionFillMetrics(
    options: ResolveTradeExecutionFillMetricsOptions,
  ): Promise<TradeExecutionFillMetrics> {
    const requestedAmount = options.adjustedRequestedAmount ?? options.requestRequestedAmount ?? null;
    const adjustedFilledAmount = this.normalizeNonNegativeNumber(options.adjustedFilledAmount);
    const isFinalizedOrder = this.isFinalizedOrderStatus(options.orderStatus);
    const fallbackFilledAmount =
      adjustedFilledAmount != null && adjustedFilledAmount > Number.EPSILON
        ? adjustedFilledAmount
        : this.normalizeNonNegativeNumber(await options.resolveFallbackFilledAmount());
    let filledAmount = fallbackFilledAmount ?? 0;
    let hasExecutedFill = Number.isFinite(filledAmount) && filledAmount > Number.EPSILON;

    // Conservative inference: only treat missing fill as executed when exchange marks order finalized.
    if (!hasExecutedFill && isFinalizedOrder && requestedAmount != null && requestedAmount > Number.EPSILON) {
      filledAmount = requestedAmount;
      hasExecutedFill = true;
    }

    return {
      requestedAmount,
      filledAmount,
      hasExecutedFill,
    };
  }

  private isFinalizedOrderStatus(status: string | null | undefined): boolean {
    if (typeof status !== 'string') {
      return false;
    }

    const normalized = status.toLowerCase();
    return normalized === 'closed' || normalized === 'filled' || normalized === 'done';
  }

  private isOpenOrderStatus(status: string | null | undefined): boolean {
    if (typeof status !== 'string') {
      return false;
    }

    const normalized = status.toLowerCase();
    return normalized === 'open' || normalized === 'wait';
  }

  private isCancelledOrderStatus(status: string | null | undefined): boolean {
    if (typeof status !== 'string') {
      return false;
    }

    const normalized = status.toLowerCase();
    return (
      normalized === 'cancel' ||
      normalized === 'canceled' ||
      normalized === 'cancelled' ||
      normalized === 'rejected' ||
      normalized === 'expired'
    );
  }

  private isMarketLikeOrder(order: Order | null | undefined): boolean {
    const orderType = typeof order?.type === 'string' ? order.type.toLowerCase() : null;
    if (orderType === 'market') {
      return true;
    }

    const upbitOrderType =
      order?.info &&
      typeof order.info === 'object' &&
      'ord_type' in order.info &&
      typeof order.info.ord_type === 'string'
        ? order.info.ord_type.toLowerCase()
        : null;
    return upbitOrderType === 'market' || upbitOrderType === 'price';
  }

  private shouldAttemptMarketOrderReconcile(status: string | null | undefined, order: Order): boolean {
    if (this.isOpenOrderStatus(status)) {
      return true;
    }
    if (this.isFinalizedOrderStatus(status) || this.isCancelledOrderStatus(status)) {
      return false;
    }

    // Market executions can transiently surface as null/new before settlement; still reconcile once.
    return this.isMarketLikeOrder(order);
  }

  private shouldContinueMarketOrderReconcile(status: string | null, order: Order, hasExecutedFill: boolean): boolean {
    if (hasExecutedFill) {
      return false;
    }
    if (this.isOpenOrderStatus(status)) {
      return true;
    }
    if (this.isFinalizedOrderStatus(status) || this.isCancelledOrderStatus(status)) {
      return false;
    }

    // Keep retrying for market orders when status is transient/unknown.
    return this.isMarketLikeOrder(order);
  }

  private resolvePrimaryOrderId(order: Order): string | null {
    if (typeof order.id !== 'string' || order.id.trim().length < 1) {
      return null;
    }

    const [firstOrderId] = order.id
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    return firstOrderId ?? null;
  }

  private async waitForMarketOrderReconcileRetry(): Promise<void> {
    if (!Number.isFinite(this.marketOrderReconcileRetryDelayMs) || this.marketOrderReconcileRetryDelayMs <= 0) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, this.marketOrderReconcileRetryDelayMs);
    });
  }

  private async reconcileOpenMarketOrderFillMetrics(options: {
    runtime: TradeRuntimeContext;
    user: User;
    symbol: string;
    orderId: string;
    adjustedRequestedAmount: number | null | undefined;
    requestRequestedAmount: number | null | undefined;
    requestedAmount: number | null;
    requestedVolume: number | null;
    filledVolume: number | null;
  }): Promise<{
    executionOrder: Order;
    orderStatus: string | null;
    requestedAmount: number | null;
    filledAmount: number;
    hasExecutedFill: boolean;
    requestedVolume: number | null;
    filledVolume: number | null;
  } | null> {
    const maxAttempts = Math.max(1, this.marketOrderReconcileMaxFetchAttempts);
    let executionOrder: Order | null = null;
    let orderStatus: string | null = null;
    let requestedAmount = options.requestedAmount;
    let filledAmount = 0;
    let hasExecutedFill = false;
    let requestedVolume = options.requestedVolume;
    let filledVolume = options.filledVolume;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const refreshedOrder = await options.runtime.exchangeService.fetchOrder(
          options.user,
          options.orderId,
          options.symbol,
        );
        if (!refreshedOrder) {
          continue;
        }

        executionOrder = refreshedOrder;
        orderStatus = typeof refreshedOrder.status === 'string' ? refreshedOrder.status : null;
        requestedVolume = this.normalizeNonNegativeNumber(refreshedOrder.amount) ?? requestedVolume;
        filledVolume = this.normalizeNonNegativeNumber(refreshedOrder.filled) ?? filledVolume;

        const metrics = await this.resolveTradeExecutionFillMetrics({
          adjustedRequestedAmount: options.adjustedRequestedAmount,
          requestRequestedAmount: options.requestRequestedAmount,
          adjustedFilledAmount: null,
          orderStatus,
          resolveFallbackFilledAmount: async () => options.runtime.exchangeService.calculateAmount(refreshedOrder),
        });
        requestedAmount = metrics.requestedAmount;
        filledAmount = metrics.filledAmount;
        hasExecutedFill = metrics.hasExecutedFill;

        if (!this.shouldContinueMarketOrderReconcile(orderStatus, refreshedOrder, hasExecutedFill)) {
          break;
        }
      } catch (error) {
        options.runtime.logger.warn(
          `Failed to reconcile open market order: user=${options.user.id}, symbol=${options.symbol}, orderId=${options.orderId}, attempt=${
            attempt + 1
          }/${maxAttempts}`,
          error,
        );
      }

      if (attempt + 1 < maxAttempts) {
        await this.waitForMarketOrderReconcileRetry();
      }
    }

    if (!executionOrder) {
      return null;
    }

    return {
      executionOrder,
      orderStatus,
      requestedAmount,
      filledAmount,
      hasExecutedFill,
      requestedVolume,
      filledVolume,
    };
  }

  /**
   * Resolves average execution price from raw order payload.
   * @param order - Exchange order payload.
   * @returns Average execution price or `null` when unavailable.
   */
  private resolveAveragePriceFromOrder(order: Order): number | null {
    const average = this.normalizeNonNegativeNumber(order?.average);
    if (average != null && average > Number.EPSILON) {
      return average;
    }

    const cost = this.normalizeNonNegativeNumber(order?.cost);
    const filled = this.normalizeNonNegativeNumber(order?.filled);
    if (cost == null || filled == null || filled <= Number.EPSILON) {
      return null;
    }

    return cost / filled;
  }

  /**
   * Normalizes unknown input to non-negative finite number.
   * @param value - Unknown numeric candidate.
   * @returns Non-negative number or `null` when invalid.
   */
  private normalizeNonNegativeNumber(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return Math.max(0, value);
  }

  // Key by symbol/category so repeated fills collapse into a single holding entry.
  private collectExecutedBuyHoldingItems<
    TExecution extends {
      request: ExecutionRequestLike;
      trade: ExecutionTradeLike | null;
    },
  >(executions: TExecution[], buyOrderType: string): HoldingLedgerRemoveItem[] {
    const boughtMap = new Map<string, HoldingLedgerRemoveItem>();

    executions.forEach(({ request, trade }) => {
      if (!trade || !request.inference || trade.type !== buyOrderType) {
        return;
      }

      if (typeof trade.filledAmount === 'number' && Number.isFinite(trade.filledAmount) && trade.filledAmount <= 0) {
        return;
      }

      const key = `${request.symbol}:${request.inference.category}`;
      boughtMap.set(key, {
        symbol: request.symbol,
        category: request.inference.category,
      });
    });

    return Array.from(boughtMap.values());
  }

  // Remove full-liquidation pairs and support legacy requests with missing inference payloads.
  private collectLiquidatedHoldingItems<
    TExecution extends {
      request: ExecutionRequestLike;
      trade: ExecutionTradeLike | null;
    },
    TExistingHoldingItem extends HoldingLedgerRemoveItem,
  >(
    executions: TExecution[],
    sellOrderType: string,
    existingHoldings?: TExistingHoldingItem[],
  ): HoldingLedgerRemoveItem[] {
    const removedMap = new Map<string, HoldingLedgerRemoveItem>();
    const categoryBySymbol = new Map<string, Set<Category>>();

    existingHoldings?.forEach((item) => {
      const categories = categoryBySymbol.get(item.symbol) ?? new Set<Category>();
      categories.add(item.category);
      categoryBySymbol.set(item.symbol, categories);
    });

    executions.forEach(({ request, trade }) => {
      if (!trade || trade.type !== sellOrderType) {
        return;
      }

      if (request.diff > -1 + Number.EPSILON) {
        return;
      }

      const requestedVolume =
        typeof trade.requestedVolume === 'number' && Number.isFinite(trade.requestedVolume)
          ? trade.requestedVolume
          : null;
      const filledVolume =
        typeof trade.filledVolume === 'number' && Number.isFinite(trade.filledVolume) ? trade.filledVolume : null;
      const isFullyLiquidated =
        requestedVolume != null && requestedVolume > Number.EPSILON && filledVolume != null
          ? this.isEffectivelyFullyLiquidatedVolume(requestedVolume, filledVolume)
          : false;
      if (!isFullyLiquidated) {
        return;
      }

      if (request.inference) {
        const key = `${request.symbol}:${request.inference.category}`;
        removedMap.set(key, {
          symbol: request.symbol,
          category: request.inference.category,
        });
        return;
      }

      const categories = categoryBySymbol.get(request.symbol);
      if (!categories || categories.size < 1) {
        return;
      }

      categories.forEach((category) => {
        const key = `${request.symbol}:${category}`;
        removedMap.set(key, {
          symbol: request.symbol,
          category,
        });
      });
    });

    return Array.from(removedMap.values());
  }

  // Use volume-based completion because notional can drift with price movement during execution.
  private isEffectivelyFullyLiquidatedVolume(requestedVolume: number, filledVolume: number): boolean {
    if (!Number.isFinite(requestedVolume) || requestedVolume <= Number.EPSILON) {
      return false;
    }
    if (!Number.isFinite(filledVolume) || filledVolume <= Number.EPSILON) {
      return false;
    }

    const remainingVolume = Math.max(0, requestedVolume - Math.max(0, filledVolume));
    if (remainingVolume <= this.fullLiquidationVolumeEpsilon) {
      return true;
    }

    return filledVolume >= requestedVolume * this.fullLiquidationFillRatioThreshold;
  }

  // Remove liquidated pairs first, then overlay newly bought pairs for the final ledger snapshot.
  private buildMergedHoldingsForSave<T extends HoldingLedgerRemoveItem>(
    existingHoldings: T[],
    liquidatedItems: HoldingLedgerRemoveItem[],
    executedBuyItems: HoldingLedgerRemoveItem[],
    inferredHoldItems: HoldingLedgerRemoveItem[] = [],
  ): HoldingLedgerSaveItem[] {
    const removedKeySet = new Set(liquidatedItems.map((item) => `${item.symbol}:${item.category}`));
    const merged = new Map<string, HoldingLedgerRemoveItem>();

    existingHoldings.forEach((item) => {
      const key = `${item.symbol}:${item.category}`;
      if (!removedKeySet.has(key)) {
        merged.set(key, item);
      }
    });

    executedBuyItems.forEach((item) => {
      const key = `${item.symbol}:${item.category}`;
      if (!removedKeySet.has(key)) {
        merged.set(key, item);
      }
    });

    inferredHoldItems.forEach((item) => {
      const key = `${item.symbol}:${item.category}`;
      if (!removedKeySet.has(key)) {
        merged.set(key, item);
      }
    });

    return Array.from(merged.values()).map((item, index) => ({
      symbol: item.symbol,
      category: item.category,
      index,
    }));
  }
}
