export interface Accumulation {
  market: string;
  symbol: string;
  avg: number;
  price: number;
  priceRate: number;
  strength: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccumulationApiResponse {
  total: number;
  count: number;
  items: {
    T: string;
    id: number;
    market: string;
    symbol: string;
    avg: number;
    price: number;
    price_rate: number;
    strength: number;
    yyyymmdd: number;
    created_at: Date;
    updated_at: Date;
  }[];
}
