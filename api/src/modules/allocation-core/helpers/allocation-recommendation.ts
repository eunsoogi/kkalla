import { Balances } from 'ccxt';

import {
  AllocationRecommendationAction,
  AllocationRecommendationData,
} from '@/modules/allocation-core/allocation-core.types';
import { CategoryItemCountConfig, getItemCountByCategory } from '@/modules/allocation-core/helpers/recommendation-item';
import { Category } from '@/modules/category/category.enum';
import { MarketFeatures } from '@/modules/upbit/upbit.interface';

export interface FeatureScoreConfig {
  featureConfidenceWeight: number;
  featureMomentumWeight: number;
  featureLiquidityWeight: number;
  featureVolatilityWeight: number;
  featureStabilityWeight: number;
  volatilityReference: number;
}

interface RecommendationFilterConfig {
  minimumTradeIntensity: number;
  minAllocationConfidence: number;
}

interface CategoryRecommendationFilterConfig extends RecommendationFilterConfig {
  categoryItemCountConfig: CategoryItemCountConfig;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return clamp(value, 0, 1);
}

export function getRecommendationScore(item: Pick<AllocationRecommendationData, 'weight' | 'confidence'>): number {
  const weight = item.weight ?? 0.1;
  const confidence = item.confidence ?? 0.7;
  return weight * 0.6 + confidence * 0.4;
}

export function getBuyPriorityScore(item: Pick<AllocationRecommendationData, 'buyScore' | 'intensity'>): number {
  if (item.buyScore != null && Number.isFinite(item.buyScore)) {
    return clamp01(item.buyScore);
  }

  return clamp01(item.intensity);
}

export function sortAllocationRecommendationsByPriority<
  T extends Pick<AllocationRecommendationData, 'hasStock' | 'buyScore' | 'intensity' | 'weight' | 'confidence'>,
>(inferences: T[]): T[] {
  return inferences.sort((a, b) => {
    if (a.hasStock && b.hasStock) {
      return 0;
    } else if (a.hasStock) {
      return -1;
    } else if (b.hasStock) {
      return 1;
    }

    const buyScoreDiff = getBuyPriorityScore(b) - getBuyPriorityScore(a);
    if (Math.abs(buyScoreDiff) < Number.EPSILON) {
      const intensityDiff = b.intensity - a.intensity;
      if (Math.abs(intensityDiff) >= Number.EPSILON) {
        return intensityDiff;
      }

      const scoreDiff = getRecommendationScore(b) - getRecommendationScore(a);
      if (Math.abs(scoreDiff) < Number.EPSILON) {
        return 0;
      }
      return scoreDiff;
    }

    return buyScoreDiff;
  });
}

export function isKrwSymbol(symbol: string): boolean {
  return symbol.endsWith('/KRW');
}

export function isOrderableSymbol(symbol: string, orderableSymbols?: Set<string>): boolean {
  if (!isKrwSymbol(symbol)) {
    return false;
  }

  if (!orderableSymbols) {
    return true;
  }

  return orderableSymbols.has(symbol);
}

export function isSellAmountSufficient(
  symbol: string,
  diff: number,
  minimumTradePrice: number,
  tradableMarketValueMap?: Map<string, number>,
): boolean {
  if (!tradableMarketValueMap) {
    return true;
  }

  const tradableMarketValue = tradableMarketValueMap.get(symbol);
  if (tradableMarketValue == null) {
    return true;
  }

  if (!Number.isFinite(tradableMarketValue) || tradableMarketValue <= 0) {
    return false;
  }

  return tradableMarketValue * Math.abs(diff) >= minimumTradePrice;
}

export function normalizeAllocationRecommendationAction(action: unknown): AllocationRecommendationAction {
  if (action === 'buy' || action === 'sell' || action === 'hold' || action === 'no_trade') {
    return action;
  }

  return 'hold';
}

interface ParsedAllocationRecommendationResponse {
  symbol?: unknown;
  action?: unknown;
  intensity?: unknown;
  confidence?: unknown;
  expectedVolatilityPct?: unknown;
  riskFlags?: unknown;
  reason?: unknown;
}

export interface NormalizedAllocationRecommendationResponse {
  action: AllocationRecommendationAction;
  intensity: number;
  confidence: number;
  expectedVolatilityPct: number;
  riskFlags: string[];
  reason: string;
}

interface NormalizeAllocationRecommendationResponseOptions {
  expectedSymbol: string;
  dropOnSymbolMismatch?: boolean;
  onSymbolMismatch?: (args: { outputSymbol: string; expectedSymbol: string }) => void;
}

export function normalizeAllocationRecommendationResponsePayload(
  response: unknown,
  options: NormalizeAllocationRecommendationResponseOptions,
): NormalizedAllocationRecommendationResponse | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const parsed = response as ParsedAllocationRecommendationResponse;
  const outputSymbol = typeof parsed.symbol === 'string' ? parsed.symbol.trim() : '';
  if (outputSymbol !== options.expectedSymbol) {
    options.onSymbolMismatch?.({
      outputSymbol,
      expectedSymbol: options.expectedSymbol,
    });
    if (options.dropOnSymbolMismatch) {
      return null;
    }
  }

  const intensity = Number(parsed.intensity);
  const confidence = Number(parsed.confidence);
  const expectedVolatilityPct = Number(parsed.expectedVolatilityPct);
  const reason = typeof parsed.reason === 'string' ? parsed.reason.trim() : '';

  return {
    action: normalizeAllocationRecommendationAction(parsed.action),
    intensity: Number.isFinite(intensity) ? clamp(intensity, -1, 1) : 0,
    confidence: Number.isFinite(confidence) ? clamp01(confidence) : 0,
    expectedVolatilityPct: Number.isFinite(expectedVolatilityPct) ? Math.max(0, expectedVolatilityPct) : 0,
    riskFlags: Array.isArray(parsed.riskFlags)
      ? parsed.riskFlags.filter((item): item is string => typeof item === 'string').slice(0, 10)
      : [],
    reason,
  };
}

export function resolveAllocationRecommendationAction(
  intensity: number,
  sellScore: number,
  modelTargetWeight: number,
  minimumTradeIntensity: number,
  sellScoreThreshold: number,
): AllocationRecommendationAction {
  if (modelTargetWeight <= 0) {
    if (intensity <= minimumTradeIntensity || sellScore >= sellScoreThreshold) {
      return 'sell';
    }
    return 'hold';
  }

  return 'buy';
}

interface CalculateAllocationModelSignalsOptions {
  intensity: number;
  marketFeatures: MarketFeatures | null;
  featureScoreConfig: FeatureScoreConfig;
  aiSignalWeight: number;
  featureSignalWeight: number;
  minimumTradeIntensity: number;
  sellScoreThreshold: number;
}

interface AllocationModelSignals {
  featureScore: number;
  buyScore: number;
  sellScore: number;
  modelTargetWeight: number;
  action: AllocationRecommendationAction;
}

export function calculateAllocationModelSignals(
  options: CalculateAllocationModelSignalsOptions,
): AllocationModelSignals {
  const aiBuy = clamp01(options.intensity);
  const aiSell = clamp01(-options.intensity);
  const featureScore = calculateFeatureScore(options.marketFeatures, options.featureScoreConfig);
  const buyScore = clamp01(options.aiSignalWeight * aiBuy + options.featureSignalWeight * featureScore);
  const sellScore = clamp01(options.aiSignalWeight * aiSell + options.featureSignalWeight * (1 - featureScore));

  let modelTargetWeight = clamp01(buyScore);
  if (options.intensity <= options.minimumTradeIntensity || sellScore >= options.sellScoreThreshold) {
    modelTargetWeight = 0;
  }

  return {
    featureScore,
    buyScore,
    sellScore,
    modelTargetWeight,
    action: resolveAllocationRecommendationAction(
      options.intensity,
      sellScore,
      modelTargetWeight,
      options.minimumTradeIntensity,
      options.sellScoreThreshold,
    ),
  };
}

export function calculateRegimeAdjustedTargetWeight(baseTargetWeight: number, regimeMultiplier: number): number {
  if (!Number.isFinite(baseTargetWeight) || baseTargetWeight <= 0) {
    return 0;
  }

  const adjustedTargetWeight = baseTargetWeight * (Number.isFinite(regimeMultiplier) ? regimeMultiplier : 1);
  return clamp01(adjustedTargetWeight);
}

export function isNoTradeRecommendation(
  inference: AllocationRecommendationData,
  minAllocationConfidence: number,
): boolean {
  if (inference.action === 'no_trade' || inference.action === 'hold') {
    return true;
  }

  if (inference.decisionConfidence != null && Number.isFinite(inference.decisionConfidence)) {
    return inference.decisionConfidence < minAllocationConfidence;
  }

  return false;
}

export function isIncludedRecommendation(
  inference: AllocationRecommendationData,
  minimumTradeIntensity: number,
  minAllocationConfidence: number,
): boolean {
  if (isNoTradeRecommendation(inference, minAllocationConfidence)) {
    return false;
  }

  if (inference.modelTargetWeight != null && Number.isFinite(inference.modelTargetWeight)) {
    return clamp01(inference.modelTargetWeight) > 0;
  }

  return inference.intensity > minimumTradeIntensity;
}

function groupRecommendationsByCategory<T extends Pick<AllocationRecommendationData, 'category'>>(
  inferences: T[],
): Array<[Category, T[]]> {
  const grouped = new Map<Category, T[]>();

  inferences.forEach((inference) => {
    const categoryInferences = grouped.get(inference.category) ?? [];
    categoryInferences.push(inference);
    grouped.set(inference.category, categoryInferences);
  });

  return Array.from(grouped.entries());
}

function getIncludedRecommendationsByCategory<T extends AllocationRecommendationData>(
  categoryInferences: T[],
  category: Category,
  config: CategoryRecommendationFilterConfig,
): T[] {
  return sortAllocationRecommendationsByPriority([...categoryInferences])
    .filter((item) => isIncludedRecommendation(item, config.minimumTradeIntensity, config.minAllocationConfidence))
    .slice(0, getItemCountByCategory(category, config.categoryItemCountConfig));
}

export function filterIncludedRecommendations<T extends AllocationRecommendationData>(
  inferences: T[],
  config: RecommendationFilterConfig,
): T[] {
  return sortAllocationRecommendationsByPriority([...inferences]).filter((item) =>
    isIncludedRecommendation(item, config.minimumTradeIntensity, config.minAllocationConfidence),
  );
}

export function filterExcludedHeldRecommendations<T extends AllocationRecommendationData>(
  inferences: T[],
  config: RecommendationFilterConfig,
): T[] {
  return sortAllocationRecommendationsByPriority([...inferences]).filter(
    (item) =>
      !isIncludedRecommendation(item, config.minimumTradeIntensity, config.minAllocationConfidence) &&
      item.hasStock &&
      !isNoTradeRecommendation(item, config.minAllocationConfidence),
  );
}

export function filterIncludedRecommendationsByCategory<T extends AllocationRecommendationData>(
  inferences: T[],
  config: CategoryRecommendationFilterConfig,
): T[] {
  const filtered = groupRecommendationsByCategory(inferences).flatMap(([category, categoryInferences]) =>
    getIncludedRecommendationsByCategory(categoryInferences, category, config),
  );

  return sortAllocationRecommendationsByPriority(filtered);
}

export function filterExcludedRecommendationsByCategory<T extends AllocationRecommendationData>(
  inferences: T[],
  config: CategoryRecommendationFilterConfig,
): T[] {
  const filtered = groupRecommendationsByCategory(inferences).flatMap(([category, categoryInferences]) => {
    const included = getIncludedRecommendationsByCategory(categoryInferences, category, config);
    const includedSet = new Set(included);

    return sortAllocationRecommendationsByPriority([...categoryInferences]).filter(
      (item) => !includedSet.has(item) && !isNoTradeRecommendation(item, config.minAllocationConfidence),
    );
  });

  return sortAllocationRecommendationsByPriority(filtered);
}

export function calculateFeatureScore(marketFeatures: MarketFeatures | null, config: FeatureScoreConfig): number {
  if (!marketFeatures) {
    return 0;
  }

  const confidence = clamp01((marketFeatures.prediction?.confidence ?? 0) / 100);
  const momentumStrength = clamp01((marketFeatures.prediction?.momentumStrength ?? 0) / 100);
  const liquidityScore = clamp01((marketFeatures.liquidityScore ?? 0) / 10);
  const volatility = Number.isFinite(marketFeatures.volatility)
    ? (marketFeatures.volatility as number)
    : config.volatilityReference;
  const volatilityRatio = clamp01(volatility / config.volatilityReference);
  const volatilityScore = clamp01(1 - volatilityRatio);
  const intensityStability = clamp01((marketFeatures.intensityVolatility?.intensityStability ?? 0) / 100);

  return clamp01(
    config.featureConfidenceWeight * confidence +
      config.featureMomentumWeight * momentumStrength +
      config.featureLiquidityWeight * liquidityScore +
      config.featureVolatilityWeight * volatilityScore +
      config.featureStabilityWeight * intensityStability,
  );
}

export function calculateAllocationBand(
  targetWeight: number,
  minAllocationBand: number,
  allocationBandRatio: number,
): number {
  return Math.max(minAllocationBand, targetWeight * allocationBandRatio);
}

export function shouldReallocate(
  targetWeight: number,
  deltaWeight: number,
  minAllocationBand: number,
  allocationBandRatio: number,
): boolean {
  return Math.abs(deltaWeight) >= calculateAllocationBand(targetWeight, minAllocationBand, allocationBandRatio);
}

export function passesCostGate(
  deltaWeight: number,
  estimatedFeeRate: number,
  estimatedSlippageRate: number,
  costGuardMultiplier: number,
): boolean {
  const minEdge = (estimatedFeeRate + estimatedSlippageRate) * costGuardMultiplier;
  return Math.abs(deltaWeight) >= minEdge;
}

export function calculateRelativeDiff(targetWeight: number, currentWeight: number): number {
  return (targetWeight - currentWeight) / (currentWeight || 1);
}

export function resolveAvailableKrwBalance(balances: Balances): number {
  const krwInfoBalance = balances.info.find(
    (item) => item.currency === item.unit_currency && item.currency.toUpperCase() === 'KRW',
  )?.balance;
  const parsedInfoBalance = Number.parseFloat(krwInfoBalance || '0');
  if (Number.isFinite(parsedInfoBalance) && parsedInfoBalance > 0) {
    return parsedInfoBalance;
  }

  const fallbackFree = Number((balances as unknown as Record<string, { free?: number | string }>).KRW?.free ?? 0);
  if (Number.isFinite(fallbackFree) && fallbackFree > 0) {
    return fallbackFree;
  }

  return 0;
}

export function estimateBuyNotionalFromRequest(
  request: { diff: number; symbol: string; marketPrice?: number },
  tradableMarketValueMap?: Map<string, number>,
  fallbackMarketPrice?: number,
): number {
  if (!Number.isFinite(request.diff) || request.diff <= 0) {
    return 0;
  }

  const baseValue = tradableMarketValueMap?.get(request.symbol) ?? fallbackMarketPrice ?? request.marketPrice ?? 0;
  if (!Number.isFinite(baseValue) || baseValue <= 0) {
    return 0;
  }

  const estimated = baseValue * request.diff;
  if (!Number.isFinite(estimated) || estimated <= 0) {
    return 0;
  }

  return estimated;
}

interface ScaleBuyRequestsToAvailableKrwOptions {
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

export function scaleBuyRequestsToAvailableKrw<
  TRequest extends {
    diff: number;
    symbol: string;
    marketPrice?: number;
  },
>(buyRequests: TRequest[], availableKrw: number, options: ScaleBuyRequestsToAvailableKrwOptions): TRequest[] {
  if (buyRequests.length < 1) {
    return [];
  }

  const estimates = buyRequests.map((request) => ({
    request,
    estimated: estimateBuyNotionalFromRequest(request, options.tradableMarketValueMap, options.fallbackMarketPrice),
  }));
  const totalEstimated = estimates.reduce((total, item) => total + item.estimated, 0);

  if (!Number.isFinite(availableKrw) || availableKrw <= 0 || totalEstimated <= 0) {
    options.onBudgetInsufficient?.({
      availableKrw,
      totalEstimated,
      requestedCount: buyRequests.length,
    });
    return [];
  }

  if (totalEstimated <= availableKrw) {
    return buyRequests;
  }

  const scale = availableKrw / totalEstimated;
  options.onBudgetScaled?.({
    availableKrw,
    totalEstimated,
    scale,
    requestedCount: buyRequests.length,
  });

  const scaledRequests = estimates
    .map(({ request, estimated }) => {
      const scaledDiff = request.diff * scale;
      const scaledEstimated = estimated * scale;
      if (!Number.isFinite(scaledDiff) || scaledDiff <= 0) {
        return null;
      }
      if (!Number.isFinite(scaledEstimated) || scaledEstimated <= options.minimumTradePrice) {
        return null;
      }

      return {
        ...request,
        diff: scaledDiff,
      };
    })
    .filter((item): item is TRequest => item !== null);

  if (scaledRequests.length < 1) {
    options.onBudgetInsufficient?.({
      availableKrw,
      totalEstimated,
      requestedCount: buyRequests.length,
    });
  }

  return scaledRequests;
}

export function toPercentString(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  return `${Math.floor(value * 100)}%`;
}
