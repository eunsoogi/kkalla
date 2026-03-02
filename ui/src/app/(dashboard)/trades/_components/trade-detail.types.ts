import type { SortDirection } from '@/enums/sort.enum';
import type { TradeTypes } from '@/enums/trade.enum';
import type { Trade } from '@/app/(dashboard)/_shared/trades/trade.types';

export interface TradeDetailListContentProps {
  symbol?: string;
  type?: TradeTypes;
  sortDirection: SortDirection;
  startDate?: Date;
  endDate?: Date;
}

export interface TradeDetailProps {
  symbol?: string;
  type?: TradeTypes;
  sortDirection: SortDirection;
  startDate?: Date;
  endDate?: Date;
}

export interface TradeListItemProps {
  item: Trade;
  t: (key: string) => string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export interface TradeDetailPanelProps {
  item: Trade;
  t: (key: string) => string;
}

export interface TradeDetailEmptyProps {
  t: (key: string) => string;
}
