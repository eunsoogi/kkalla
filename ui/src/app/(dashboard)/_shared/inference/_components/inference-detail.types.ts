import type { Category } from '@/enums/category.enum';
import type { SortDirection } from '@/enums/sort.enum';

import type { AllocationRecommendation, MarketSignal } from '../_types/inference.types';

export type Recommendation = MarketSignal | AllocationRecommendation;
export type Translator = (key: string) => string;

export interface InferenceDetailListContentProps {
  type: 'market' | 'allocation';
  symbol?: string;
  category?: Category;
  sortDirection: SortDirection;
  startDate?: Date;
  endDate?: Date;
}

export interface InferenceDetailProps {
  type: 'market' | 'allocation';
  symbol?: string;
  category?: Category;
  decision?: string;
  sortDirection: SortDirection;
  startDate?: Date;
  endDate?: Date;
}

export interface MarketListItemProps {
  item: MarketSignal;
  t: Translator;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export interface AllocationListItemProps {
  item: AllocationRecommendation;
  t: Translator;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export interface MarketDetailPanelProps {
  item: MarketSignal;
  t: Translator;
  pointUnitLabel: string;
}

export interface AllocationDetailPanelProps {
  item: AllocationRecommendation;
  t: Translator;
  pointUnitLabel: string;
}

export interface InferenceDetailEmptyProps {
  t: Translator;
}
