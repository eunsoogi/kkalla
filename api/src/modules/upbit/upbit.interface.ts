export interface Candle {
  market: string;
  timestamp: Date;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume: number;
}

export enum BalanceTypes {
  BTC = 'BTC',
  KRW = 'KRW',
}

export enum OrderTypes {
  BUY = 'buy',
  SELL = 'sell',
}
