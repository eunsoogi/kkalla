import { Injectable } from '@nestjs/common';

import { Balances, Order } from 'ccxt';

import { AllocationRecommendation } from '@/modules/allocation/entities/allocation-recommendation.entity';
import { Category } from '@/modules/category/category.enum';
import { executeTradesSequentiallyWithRequests } from '@/modules/trade-execution-ledger/helpers/trade-execution-runner';
import { Trade } from '@/modules/trade/entities/trade.entity';
import { TradeData, TradeRequest } from '@/modules/trade/trade.types';
import { UPBIT_MINIMUM_TRADE_PRICE } from '@/modules/upbit/upbit.constant';
import { OrderTypes } from '@/modules/upbit/upbit.enum';
import { AdjustedOrderResult, MarketFeatures } from '@/modules/upbit/upbit.types';
import { User } from '@/modules/user/entities/user.entity';
import { clamp01 } from '@/utils/math';
import { formatNumber, formatRatePercent } from '@/utils/number';

import { SHARED_REBALANCE_POLICY, SHARED_TRADE_EXECUTION_RUNTIME } from './allocation-core.constants';
import {
  AllocationRecommendationData,
  CategoryExposureCaps,
  MarketRegimePolicy,
  TradeExecutionMessageV2,
} from './allocation-core.types';
import {
  calculateAllocationBand,
  calculateAllocationModelSignals,
  calculateRegimeAdjustedTargetWeight,
  calculateRelativeDiff,
  filterExcludedRecommendationsByCategory,
  filterIncludedRecommendationsByCategory,
  isNoTradeRecommendation,
  isOrderableSymbol,
  isSellAmountSufficient,
  normalizeAllocationRecommendationResponsePayload,
  resolveAvailableKrwBalance,
  scaleBuyRequestsToAvailableKrw,
  shouldReallocate,
} from './helpers/allocation-recommendation';
import { buildAllocationRecommendationPromptMessages } from './helpers/allocation-recommendation-context';
import {
  applyHeldAssetFlags,
  filterAuthorizedRecommendationItems,
  filterUniqueNonBlacklistedItems,
} from './helpers/recommendation-item';
import {
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
} from './trade-orchestration.types';

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
   * Shared minimum trade intensity threshold used by allocation/risk recommendation filtering.
   */
  public getMinimumTradeIntensity(): number {
    return this.minimumTradeIntensity;
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
  public calculateModelSignals(intensity: number, marketFeatures: MarketFeatures | null) {
    return calculateAllocationModelSignals({
      intensity,
      marketFeatures,
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
    const normalizedVolatility = clamp01(expectedVolatilityPct);
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
      // so sudden feed spikes do not explode portfolio sizing.
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
   * Loads latest recommendation row for a single symbol.
   */
  private async fetchLatestRecommendationBySymbol(
    symbol: string,
    errorService: RecommendationMetricsErrorService,
    onError: (error: unknown) => void,
  ): Promise<AllocationRecommendation[]> {
    const operation = () =>
      AllocationRecommendation.find({
        where: { symbol },
        order: { createdAt: 'DESC' },
        take: 1,
      });

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
    const symbols = Array.from(new Set(options.recommendationItems.map((item) => item.symbol)));
    const latestRecommendationMetricsBySymbol = await Promise.all(
      symbols.map(async (symbol) => {
        const recentRecommendations = await this.fetchLatestRecommendationBySymbol(
          symbol,
          options.errorService,
          options.onError,
        );
        const latestRecommendation = recentRecommendations[0];
        const latestIntensity =
          latestRecommendation?.intensity != null && Number.isFinite(latestRecommendation.intensity)
            ? Number(latestRecommendation.intensity)
            : null;
        const latestModelTargetWeight =
          latestRecommendation?.modelTargetWeight != null && Number.isFinite(latestRecommendation.modelTargetWeight)
            ? Number(latestRecommendation.modelTargetWeight)
            : null;

        return [
          symbol,
          {
            intensity: latestIntensity,
            modelTargetWeight: latestModelTargetWeight,
          },
        ] as const;
      }),
    );

    return new Map(latestRecommendationMetricsBySymbol);
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
   * Shared normalization for recommendation response payloads.
   */
  public normalizeRecommendationResponsePayload(
    response: unknown,
    options: Parameters<typeof normalizeAllocationRecommendationResponsePayload>[1],
  ) {
    return normalizeAllocationRecommendationResponsePayload(response, options);
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
          inference,
          expectedEdgeRate,
          estimatedCostRate,
          spreadRate: inference.spreadRate ?? null,
          impactRate: inference.impactRate ?? null,
          executionUrgency: adjustedDiff < 0 ? ('urgent' as const) : ('normal' as const),
          triggerReason: payoffOverlay.triggerReason ?? 'included_rebalance',
        };
      })
      .filter((item): item is TradeRequest => item !== null)
      .sort((a, b) => a.diff - b.diff);
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

        const uncappedTargetWeight = clamp01(clamp01(inference.modelTargetWeight) * regimeMultiplier) / normalizedTopK;
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
      .filter((item): item is TradeRequest => item !== null)
      .sort((a, b) => a.diff - b.diff);
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
   * Builds current portfolio weight map from balances and tradable market value.
   */
  public async buildCurrentWeightMap(
    balances: Balances,
    totalMarketValue: number,
    getPrice: (symbol: string) => Promise<number>,
    orderableSymbols?: Set<string>,
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
          if (!Number.isFinite(tradableBalance) || tradableBalance <= 0) {
            return { symbol, weight: 0 };
          }
          if (!this.isOrderableSymbol(symbol, orderableSymbols)) {
            return { symbol, weight: 0 };
          }

          try {
            const currPrice = await getPrice(symbol);
            return { symbol, weight: (tradableBalance * currPrice) / totalMarketValue };
          } catch {
            // Price API fallback: use avg_buy_price to keep weight estimation available.
            const avgBuyPrice = parseFloat(item.avg_buy_price || '0');
            if (!Number.isFinite(avgBuyPrice) || avgBuyPrice <= 0) {
              return null;
            }
            return { symbol, weight: (tradableBalance * avgBuyPrice) / totalMarketValue };
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

    const marketPrice = await runtime.exchangeService.calculateTradableMarketValue(balances, orderableSymbols);
    assertLockOrThrow();

    const currentWeights = await this.buildCurrentWeightMap(
      balances,
      marketPrice,
      (symbol) => runtime.exchangeService.getPrice(symbol),
      orderableSymbols,
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
    ];
    // Apply turnover cap symmetrically to sell-side before any buy requests.
    const maxSellRequestCount = Math.max(1, Math.ceil(rawSellRequests.length * turnoverCap));
    const sellRequests = rawSellRequests.slice(0, maxSellRequestCount);

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
    if (refreshedBalances) {
      const refreshedSnapshot = await this.buildTradeExecutionSnapshot({
        runtime,
        balances: refreshedBalances,
        referenceSymbols,
        assertLockOrThrow,
      });
      const refreshedIncludedRequests = buildIncludedRequests(refreshedSnapshot);
      const buyRequests = refreshedIncludedRequests.filter((item) => item.diff > 0);
      const availableKrw = resolveAvailableKrwBalance(refreshedBalances);
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
      const maxBuyRequestCount = Math.max(1, Math.ceil(scaledBuyRequests.length * turnoverCap));
      const cappedBuyRequests = scaledBuyRequests.slice(0, maxBuyRequestCount);
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
    // Holding ledger is replaced from execution result to keep category/symbol pairs canonical.
    await holdingLedgerService.replaceHoldingsForUser(
      user,
      this.buildMergedHoldingsForSave(existingHoldings, liquidatedItems, executedBuyItems),
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
                    executionMode: trade.executionMode ?? '-',
                    orderStatus: trade.orderStatus ?? '-',
                    filledRatio: formatRatePercent(trade.filledRatio),
                    expectedEdgeRate: formatRatePercent(trade.expectedEdgeRate),
                    estimatedCostRate: formatRatePercent(trade.estimatedCostRate),
                    spreadRate: formatRatePercent(trade.spreadRate),
                    impactRate: formatRatePercent(trade.impactRate),
                    triggerReason: trade.triggerReason ?? '-',
                    gateBypassedReason: trade.gateBypassedReason ?? '-',
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
   * Resolves first cancellable order id from exchange payload.
   * @param order - Exchange order payload.
   * @returns Normalized order id or `null` when unavailable.
   */
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

    const type = runtime.exchangeService.getOrderType(order);
    const { requestedAmount, filledAmount, filledRatio, hasExecutedFill } = await this.resolveTradeExecutionFillMetrics(
      {
        adjustedRequestedAmount: adjustedOrder.requestedAmount,
        requestRequestedAmount: request.requestedAmount,
        adjustedFilledAmount: adjustedOrder.filledAmount,
        adjustedFilledRatio: adjustedOrder.filledRatio,
        resolveFallbackFilledAmount: async () => runtime.exchangeService.calculateAmount(order),
      },
    );
    const expectedEdgeRate = adjustedOrder.expectedEdgeRate ?? request.expectedEdgeRate ?? null;
    if (!hasExecutedFill) {
      const orderId = this.resolvePrimaryOrderId(order);
      if (adjustedOrder.executionMode === 'limit_post_only' && orderId) {
        try {
          // Prevent unfilled post-only orders from lingering outside the rebalance ledger pipeline.
          await runtime.exchangeService.cancelOrder(user, orderId, request.symbol);
          runtime.logger.log(
            runtime.i18n.t('logging.trade.post_only_cancelled', {
              args: {
                id: user.id,
                symbol: request.symbol,
                orderId,
              },
            }),
          );
        } catch (error) {
          runtime.logger.warn(
            runtime.i18n.t('logging.trade.post_only_cancel_failed', {
              args: {
                id: user.id,
                symbol: request.symbol,
                orderId,
              },
            }),
            error,
          );
          // Persist a trace record when cancellation fails so operators can investigate potential drift.
          await this.saveTrade(user, {
            symbol: request.symbol,
            type,
            amount: 0,
            profit: 0,
            inference: request.inference,
            executionMode: adjustedOrder.executionMode ?? request.executionMode ?? null,
            orderType: adjustedOrder.orderType ?? request.orderType ?? null,
            timeInForce: adjustedOrder.timeInForce ?? request.timeInForce ?? null,
            requestPrice: adjustedOrder.requestPrice ?? request.requestPrice ?? null,
            averagePrice: adjustedOrder.averagePrice ?? null,
            requestedAmount,
            filledAmount,
            filledRatio,
            orderStatus: adjustedOrder.orderStatus ?? order.status ?? 'open',
            expectedEdgeRate,
            estimatedCostRate: adjustedOrder.estimatedCostRate ?? request.estimatedCostRate ?? null,
            spreadRate: adjustedOrder.spreadRate ?? request.spreadRate ?? null,
            impactRate: adjustedOrder.impactRate ?? request.impactRate ?? null,
            missedOpportunityCost: null,
            gateBypassedReason: adjustedOrder.gateBypassedReason ?? request.gateBypassedReason ?? null,
            triggerReason: adjustedOrder.triggerReason ?? request.triggerReason ?? 'post_only_unfilled_cancel_failed',
          });
        }
        return null;
      }
      runtime.logger.log(runtime.i18n.t('logging.trade.not_exist', { args: { id: user.id, symbol: request.symbol } }));
      return null;
    }

    const amount = filledAmount;
    const profit = await runtime.exchangeService.calculateProfit(request.balances, order, amount);
    // Estimate unrealized edge lost by partial fill (for post-trade diagnostics only).
    const missedOpportunityCost =
      requestedAmount != null &&
      requestedAmount > 0 &&
      expectedEdgeRate != null &&
      Number.isFinite(expectedEdgeRate) &&
      filledRatio != null &&
      Number.isFinite(filledRatio) &&
      filledRatio < 1
        ? requestedAmount * (1 - filledRatio) * expectedEdgeRate
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
      executionMode: adjustedOrder.executionMode ?? request.executionMode ?? null,
      orderType: adjustedOrder.orderType ?? request.orderType ?? null,
      timeInForce: adjustedOrder.timeInForce ?? request.timeInForce ?? null,
      requestPrice: adjustedOrder.requestPrice ?? request.requestPrice ?? null,
      averagePrice: adjustedOrder.averagePrice ?? null,
      requestedAmount,
      filledAmount,
      filledRatio,
      orderStatus: adjustedOrder.orderStatus ?? order.status ?? null,
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

    const expectedVolatility = Number(inference.expectedVolatilityPct ?? 0);
    const decisionConfidence = clamp01(inference.decisionConfidence ?? inference.confidence ?? 0.5);
    const sellScore = clamp01(inference.sellScore ?? 0);
    const buyScore = clamp01(inference.buyScore ?? 0);
    const previousTarget = clamp01(inference.prevModelTargetWeight ?? 0);
    const currentTarget = clamp01(inference.modelTargetWeight ?? 0);

    if (sellScore >= 0.75 && expectedVolatility >= 0.03) {
      const stopLossFloor = Math.max(policy.payoffOverlayStopLossMin, -Math.min(1, expectedVolatility * 4));
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
      executionMode: request.executionMode ?? 'market',
      orderType: request.orderType ?? 'market',
      timeInForce: request.timeInForce ?? null,
      requestPrice: request.requestPrice ?? null,
      requestedAmount: request.requestedAmount ?? null,
      requestedVolume: null,
      filledAmount: null,
      filledRatio: null,
      averagePrice: null,
      orderStatus: null,
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
    return Boolean(value && typeof value === 'object' && 'order' in value && 'executionMode' in value);
  }

  /**
   * Resolves normalized execution fill metrics for persisted trades.
   */
  private async resolveTradeExecutionFillMetrics(
    options: ResolveTradeExecutionFillMetricsOptions,
  ): Promise<TradeExecutionFillMetrics> {
    const requestedAmount = options.adjustedRequestedAmount ?? options.requestRequestedAmount ?? null;
    const adjustedFilledAmount = this.normalizeNonNegativeNumber(options.adjustedFilledAmount);
    const fallbackFilledAmount =
      adjustedFilledAmount ?? this.normalizeNonNegativeNumber(await options.resolveFallbackFilledAmount());
    const filledAmount = fallbackFilledAmount ?? 0;
    const adjustedFilledRatio = this.normalizeNonNegativeNumber(options.adjustedFilledRatio);
    const filledRatio =
      adjustedFilledRatio ??
      (requestedAmount != null && requestedAmount > 0
        ? Math.max(0, Math.min(1, filledAmount / requestedAmount))
        : null);
    const hasExecutedFill =
      Number.isFinite(filledAmount) &&
      filledAmount > Number.EPSILON &&
      (filledRatio == null || (Number.isFinite(filledRatio) && filledRatio > Number.EPSILON));

    return {
      requestedAmount,
      filledAmount,
      filledRatio,
      hasExecutedFill,
    };
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

      if (typeof trade.filledRatio === 'number' && Number.isFinite(trade.filledRatio) && trade.filledRatio <= 0) {
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

  // Remove liquidated pairs first, then overlay newly bought pairs for the final ledger snapshot.
  private buildMergedHoldingsForSave<T extends HoldingLedgerRemoveItem>(
    existingHoldings: T[],
    liquidatedItems: HoldingLedgerRemoveItem[],
    executedBuyItems: HoldingLedgerRemoveItem[],
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

    return Array.from(merged.values()).map((item, index) => ({
      symbol: item.symbol,
      category: item.category,
      index,
    }));
  }
}
