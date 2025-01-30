export interface Accumulation {
  market: string;
  symbol: string;
  avg: number;
  price: number;
  priceRate: number;
  accTradePrice: number;
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
    data: {
      acc_ask_volume: number;
      acc_bid_volume: number;
      acc_trade_price: number;
      acc_trade_price_24h: number;
      acc_trade_volume: number;
      acc_trade_volume_24h: number;
      ask_bid: string;
      change: string;
      change_price: number;
      change_rate: number;
      code: string;
      delisting_date: string | null;
      high_price: number;
      highest_52_week_date: string;
      highest_52_week_price: number;
      is_trading_suspended: boolean;
      low_price: number;
      lowest_52_week_date: string;
      lowest_52_week_price: number;
      market_state: string;
      market_warning: string;
      opening_price: number;
      prev_closing_price: number;
      signed_change_price: number;
      signed_change_rate: number;
      stream_type: string;
      timestamp: number;
      trade_date: string;
      trade_price: number;
      trade_time: string;
      trade_timestamp: number;
      trade_volume: number;
      type: string;
    };
  }[];
}
