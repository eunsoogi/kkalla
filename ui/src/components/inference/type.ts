import { ItemResponse } from '@/types/item-response.type';

export enum InferenceDicisionTypes {
  BUY = 'buy',
  SELL = 'sell',
  HOLD = 'hold',
}

export interface Inference {
  id: number;
  decision: InferenceDicisionTypes;
  rate: number;
  reason: string;
  reflection: string;
  createdAt: Date;
  updatedAt: Date;
}

export const initialState: ItemResponse<Inference> = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};
