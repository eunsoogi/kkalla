import { AllocationRecommendation } from '@/app/(dashboard)/_shared/inference/_types/inference.types';
import { TradeTypes } from '@/enums/trade.enum';
import { State } from '@/shared/types/action-state.types';
import { CursorItem, PaginatedItem } from '@/shared/types/pagination.types';

export interface TradeApiItem {
  id: string;
  type: TradeTypes;
  symbol: string;
  amount: number;
  profit: number;
  expectedEdgeRate?: number | null;
  estimatedCostRate?: number | null;
  spreadRate?: number | null;
  impactRate?: number | null;
  triggerReason?: string | null;
  gateBypassedReason?: string | null;
  decisionRequestedTradeNotional?: number | null;
  decisionCappedTradeNotional?: number | null;
  decisionPositionClass?: 'existing' | 'new' | null;
  decisionRegimeSource?: 'live' | 'cache_fallback' | 'unavailable_risk_off' | null;
  decisionExecutionUrgency?: 'urgent' | 'normal' | null;
  realizedCostRate?: number | null;
  costCalibrationCoefficient?: number | null;
  inference: AllocationRecommendation;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Trade extends Omit<TradeApiItem, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

export const normalizeTrade = (item: TradeApiItem): Trade => ({
  ...item,
  createdAt: new Date(item.createdAt),
  updatedAt: new Date(item.updatedAt),
});

export const normalizeTrades = (items: TradeApiItem[]): Trade[] => items.map(normalizeTrade);

export const normalizeTradeCursor = (data: CursorItem<TradeApiItem>): CursorItem<Trade> => ({
  ...data,
  items: normalizeTrades(data.items),
});

export const normalizeTradePagination = (data: PaginatedItem<TradeApiItem>): PaginatedItem<Trade> => ({
  ...data,
  items: normalizeTrades(data.items),
});

export type TradeFieldAbsence = 'not_applicable' | 'not_captured' | 'pending';

export interface TradeExplanation {
  summary: string;
  why: string;
  triageCue: string | null;
  decisionSummaryRows: Array<{ key: string; label: string; value: string }>;
  executionLimitRows: Array<{ key: string; label: string; value: string }>;
  costReviewRows: Array<{ key: string; label: string; value: string }>;
  modeFallbackRows: Array<{ key: string; label: string; value: string }>;
}

export interface ProfitResponse extends State {
  data?: {
    profit: number;
    todayProfit?: number;
  };
}

export const initialState: PaginatedItem<Trade> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};

export const initialCursorState: CursorItem<Trade> = {
  success: true,
  message: null,
  items: [],
  nextCursor: null,
  hasNextPage: false,
  total: 0,
};
