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
  filledAmount?: number | null;
  expectedEdgeRate?: number | null;
  estimatedCostRate?: number | null;
  spreadRate?: number | null;
  impactRate?: number | null;
  missedOpportunityCost?: number | null;
  gateBypassedReason?: string | null;
  triggerReason?: string | null;
}
