import { InferenceDicisionTypes } from '../enums/inference.enum';
import { CursorItem, PaginatedItem } from './item.interface';

export interface Inference {
  id: string;
  decision: InferenceDicisionTypes;
  rate: number;
  reason: string;
  reflection: string;
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
