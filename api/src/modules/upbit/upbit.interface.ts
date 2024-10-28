export interface Candle {
  market: string;
  candleDateTimeUTC: string;
  candleDateTimeKST: string;
  timestamp: number;
  openingPrice: number;
  highPrice: number;
  lowPrice: number;
  tradePrice: number;
  prevClosingPrice?: number;
  changePrice?: number;
  changeRate?: number;
  candleAccTradePrice: number;
  candleAccTradeVolume: number;
  unit?: number;
}

export interface CandleResponse {
  market: string;
  candle_date_time_utc: string;
  candle_date_time_kst: string;
  timestamp: number;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  prev_closing_price?: number;
  change_price?: number;
  change_rate?: number;
  candle_acc_trade_price: number;
  candle_acc_trade_volume: number;
  unit?: number;
}
