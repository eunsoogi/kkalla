import { Column } from 'typeorm';

export enum TradeTypes {
  BUY = 'buy',
  SELL = 'sell',
}

export class BalanceTypes {
  @Column({ type: 'double', default: 0 })
  krw: number;

  @Column({ type: 'double', default: 0 })
  coin: number;
}
