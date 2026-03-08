import { Balances } from 'ccxt';

import { AllocationRecommendationData } from '../allocation-core/allocation-core.types';
import { SortDirection } from '../item/item.enum';
import { OrderTypes } from '../upbit/upbit.enum';
import { OrderExecutionUrgency, UpbitOrderCostEstimate } from '../upbit/upbit.types';

export interface TradeFilter {
  symbol?: string;
  type?: OrderTypes;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
  sortDirection?: SortDirection;
}

export interface TradeRequest {
  symbol: string;
  diff: number;
  balances: Balances;
  marketPrice?: number;
  // Internal execution-planning fields used only while ranking/capping requests.
  currentSymbolNotional?: number | null;
  targetGapWeight?: number | null;
  requestedTradeNotional?: number | null;
  cappedTradeNotional?: number | null;
  cappedTradeDiff?: number | null;
  sizingContractVersion?: number | null;
  selectionPolicyVersion?: number | null;
  regimePolicyState?: 'available' | 'regimeUnavailable' | null;
  regimePolicySource?: 'live' | 'cache_fallback' | 'unavailable_risk_off' | null;
  forcedFullLiquidation?: boolean | null;
  estimatedNotional?: number | null;
  currentWeight?: number | null;
  targetWeight?: number | null;
  deltaWeight?: number | null;
  positionClass?: 'existing' | 'new';
  expectedNetEdge?: number | null;
  inference?: AllocationRecommendationData;
  expectedEdgeRate?: number | null;
  estimatedCostRate?: number | null;
  spreadRate?: number | null;
  impactRate?: number | null;
  gateBypassedReason?: string | null;
  triggerReason?: string | null;
  requestedAmount?: number | null;
  requestPrice?: number | null;
  executionUrgency?: OrderExecutionUrgency;
  costEstimate?: UpbitOrderCostEstimate | null;
}

export interface TradeData {
  symbol: string;
  type: OrderTypes;
  amount: number;
  profit: number;
  inference?: AllocationRecommendationData;
  requestPrice?: number | null;
  averagePrice?: number | null;
  requestedAmount?: number | null;
  requestedVolume?: number | null;
  filledAmount?: number | null;
  filledVolume?: number | null;
  expectedEdgeRate?: number | null;
  estimatedCostRate?: number | null;
  spreadRate?: number | null;
  impactRate?: number | null;
  missedOpportunityCost?: number | null;
  decisionContextVersion?: number | null;
  decisionPortfolioValue?: number | null;
  decisionSymbolNotional?: number | null;
  decisionRequestedTradeNotional?: number | null;
  decisionCappedTradeNotional?: number | null;
  decisionExpectedNetEdgeRate?: number | null;
  decisionPositionClass?: 'existing' | 'new' | null;
  decisionRegimeSource?: 'live' | 'cache_fallback' | 'unavailable_risk_off' | null;
  decisionExecutionUrgency?: OrderExecutionUrgency | null;
  realizedCostRate?: number | null;
  costCalibrationCoefficient?: number | null;
  gateBypassedReason?: string | null;
  triggerReason?: string | null;
}
