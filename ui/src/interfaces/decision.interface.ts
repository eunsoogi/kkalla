import { DecisionTypes } from '../enums/decision.enum';
import { PaginatedItem } from './item.interface';

export interface Decision {
  id: string;
  seq: number;
  decision: DecisionTypes;
  orderRatio: number;
  weightLowerBound: number;
  weightUpperBound: number;
  reason: string;
  createdAt?: string;
  updatedAt?: string;
}

export const initialPaginatedState: PaginatedItem<Decision> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};
