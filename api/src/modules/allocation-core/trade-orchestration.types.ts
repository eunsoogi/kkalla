import type { Logger } from '@nestjs/common';

import type { Balances } from 'ccxt';
import type { I18nService } from 'nestjs-i18n';

import type { Category } from '@/modules/category/category.enum';
import type { HoldingLedgerService } from '@/modules/holding-ledger/holding-ledger.service';
import type { NotifyService } from '@/modules/notify/notify.service';
import type { TradeRequest } from '@/modules/trade/trade.types';
import type { UpbitService } from '@/modules/upbit/upbit.service';
import type { User } from '@/modules/user/entities/user.entity';

import type { AllocationRecommendationData, CategoryExposureCaps, RecommendationItem } from './allocation-core.types';

export interface PayoffOverlayResult {
  diff: number;
  triggerReason: string | null;
}

export interface TradeRuntimeContext {
  logger: Logger;
  i18n: I18nService;
  exchangeService: UpbitService;
}

export interface TradePolicyConfig {
  minimumAllocationConfidence: number;
  minimumAllocationBand: number;
  allocationBandRatio: number;
  estimatedFeeRate: number;
  estimatedSlippageRate: number;
  edgeRiskBufferRate: number;
  stagedExitLight: number;
  stagedExitMedium: number;
  stagedExitFull: number;
  payoffOverlayStopLossMin: number;
  payoffOverlayTrailingMin: number;
  minimumTradePrice: number;
}

export interface IncludedTradeRequestBuildOptions {
  runtime: TradeRuntimeContext;
  policy?: TradePolicyConfig;
  balances: Balances;
  candidates: AllocationRecommendationData[];
  regimeMultiplier: number;
  currentWeights: Map<string, number>;
  marketPrice: number;
  calculateTargetWeight: (inference: AllocationRecommendationData, regimeMultiplier: number) => number;
  orderableSymbols?: Set<string>;
  tradableMarketValueMap?: Map<string, number>;
  rebalanceBandMultiplier?: number;
  categoryExposureCaps?: CategoryExposureCaps;
}

export interface ExcludedTradeRequestBuildOptions {
  runtime: TradeRuntimeContext;
  policy?: TradePolicyConfig;
  balances: Balances;
  candidates: AllocationRecommendationData[];
  marketPrice: number;
  orderableSymbols?: Set<string>;
  tradableMarketValueMap?: Map<string, number>;
}

export interface NoTradeTrimRequestBuildOptions {
  runtime: TradeRuntimeContext;
  policy?: TradePolicyConfig;
  balances: Balances;
  candidates: AllocationRecommendationData[];
  topK: number;
  regimeMultiplier: number;
  currentWeights: Map<string, number>;
  marketPrice: number;
  orderableSymbols?: Set<string>;
  tradableMarketValueMap?: Map<string, number>;
  rebalanceBandMultiplier?: number;
  categoryExposureCaps?: CategoryExposureCaps;
}

export interface TradeExecutionSnapshot {
  balances: Balances;
  orderableSymbols: Set<string>;
  marketPrice: number;
  currentWeights: Map<string, number>;
  tradableMarketValueMap: Map<string, number>;
}

export interface BuildTradeExecutionSnapshotOptions {
  runtime: TradeRuntimeContext;
  balances: Balances;
  referenceSymbols: string[];
  assertLockOrThrow?: () => void;
}

export interface ExecuteTradeOptions {
  runtime: TradeRuntimeContext;
  user: User;
  request: TradeRequest;
}

export interface ExecuteRebalanceTradesOptions {
  runtime: TradeRuntimeContext;
  policy?: TradePolicyConfig;
  holdingLedgerService: HoldingLedgerService;
  notifyService: NotifyService;
  user: User;
  referenceSymbols: string[];
  initialSnapshot: TradeExecutionSnapshot;
  turnoverCap: number;
  additionalSellRequests?: TradeRequest[];
  assertLockOrThrow?: () => void;
  buildExcludedRequests: (snapshot: TradeExecutionSnapshot) => TradeRequest[];
  buildIncludedRequests: (snapshot: TradeExecutionSnapshot) => TradeRequest[];
  buildNoTradeTrimRequests: (snapshot: TradeExecutionSnapshot) => TradeRequest[];
}

export interface ExecutionRequestLike {
  symbol: string;
  diff: number;
  inference?: {
    category: Category;
  };
}

export interface ExecutionTradeLike {
  type: string;
  filledAmount?: number | null;
  filledRatio?: number | null;
}

export interface HoldingLedgerRemoveItem {
  symbol: string;
  category: Category;
}

export interface HoldingLedgerSaveItem {
  symbol: string;
  category: Category;
  index: number;
}

export interface TradeExecutionFillMetrics {
  requestedAmount: number | null;
  filledAmount: number;
  filledRatio: number | null;
  hasExecutedFill: boolean;
}

export interface ResolveTradeExecutionFillMetricsOptions {
  adjustedRequestedAmount?: number | null;
  requestRequestedAmount?: number | null;
  adjustedFilledAmount?: number | null;
  adjustedFilledRatio?: number | null;
  resolveFallbackFilledAmount(): Promise<number>;
}

export interface BuildOrderableSymbolSetOptions {
  isSymbolExist: (symbol: string) => Promise<boolean>;
  onAllCheckFailed?: () => void;
  onPartialCheck?: () => void;
}

export interface MarketRegimeReaderResult {
  btcDominance?: unknown;
  altcoinIndex?: unknown;
  feargreed?: {
    index?: unknown;
  } | null;
}

export interface LatestRecommendationMetrics {
  intensity: number | null;
  modelTargetWeight: number | null;
}

export interface RecommendationMetricsErrorService {
  retryWithFallback<T>(operation: () => Promise<T>): Promise<T>;
}

export interface BuildLatestRecommendationMetricsMapOptions {
  recommendationItems: RecommendationItem[];
  errorService: RecommendationMetricsErrorService;
  onError: (error: unknown) => void;
}
