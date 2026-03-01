import { AllocationRecommendation } from '@/app/(dashboard)/_shared/inference/_types/inference.types';
import { TradeTypes } from '@/enums/trade.enum';
import { State } from '@/shared/types/action-state.types';
import { CursorItem, PaginatedItem } from '@/shared/types/pagination.types';

export interface Trade {
  id: string;
  type: TradeTypes;
  symbol: string;
  amount: number;
  profit: number;
  executionMode?: 'market' | 'limit_ioc' | 'limit_post_only' | null;
  filledRatio?: number | null;
  orderStatus?: string | null;
  expectedEdgeRate?: number | null;
  estimatedCostRate?: number | null;
  spreadRate?: number | null;
  impactRate?: number | null;
  triggerReason?: string | null;
  gateBypassedReason?: string | null;
  inference: AllocationRecommendation;
  createdAt: Date;
  updatedAt: Date;
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
