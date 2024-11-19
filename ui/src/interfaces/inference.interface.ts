import { InferenceDicisionTypes } from '../enums/inference.enum';
import { CursorItem, PaginatedItem } from './item.interface';

export interface Inference {
  id: string;
  decision: InferenceDicisionTypes;
  orderRatio: number;
  weightLowerBound: number;
  weightUpperBound: number;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

export const initialPaginatedState: PaginatedItem<Inference> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};

export const initialCursorState: CursorItem<Inference> = {
  success: true,
  message: null,
  items: [],
  nextCursor: null,
  hasNextPage: false,
  total: 0,
};
