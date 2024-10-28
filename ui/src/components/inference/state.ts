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

export type InferenceResponse = {
  success: boolean;
  message?: string | null;
  items: Inference[];
  total: number;
  page: number;
  perPage?: number;
  totalPages: number;
};

export const initialState: InferenceResponse = {
  success: true,
  message: null,
  items: [],
  total: 0,
  page: 1,
  totalPages: 1,
};
