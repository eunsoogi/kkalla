import { Category } from '@/modules/category/category.enum';
import { OrderTypes } from '@/modules/upbit/upbit.enum';

import {
  buildMergedHoldingsForSave,
  collectExecutedBuyHoldingItems,
  collectLiquidatedHoldingItems,
} from './holding-ledger-trade';

describe('trade-holding-ledger utils', () => {
  it('should collect unique executed buy holding items only', () => {
    const result = collectExecutedBuyHoldingItems(
      [
        {
          request: {
            symbol: 'BTC/KRW',
            diff: 1,
            inference: { category: Category.COIN_MAJOR },
          },
          trade: { type: OrderTypes.BUY },
        },
        {
          request: {
            symbol: 'BTC/KRW',
            diff: 1,
            inference: { category: Category.COIN_MAJOR },
          },
          trade: { type: OrderTypes.BUY },
        },
        {
          request: {
            symbol: 'ETH/KRW',
            diff: -1,
            inference: { category: Category.COIN_MINOR },
          },
          trade: { type: OrderTypes.SELL },
        },
        {
          request: {
            symbol: 'XRP/KRW',
            diff: 1,
          },
          trade: { type: OrderTypes.BUY },
        },
      ],
      OrderTypes.BUY,
    );

    expect(result).toEqual([
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
      },
    ]);
  });

  it('should collect full liquidations from inference or existing holding ledger fallback', () => {
    const result = collectLiquidatedHoldingItems(
      [
        {
          request: {
            symbol: 'BTC/KRW',
            diff: -1,
            inference: { category: Category.COIN_MAJOR },
          },
          trade: { type: OrderTypes.SELL },
        },
        {
          request: {
            symbol: 'XRP/KRW',
            diff: -1,
          },
          trade: { type: OrderTypes.SELL },
        },
        {
          request: {
            symbol: 'ETH/KRW',
            diff: -0.2,
            inference: { category: Category.COIN_MINOR },
          },
          trade: { type: OrderTypes.SELL },
        },
      ],
      OrderTypes.SELL,
      [{ symbol: 'XRP/KRW', category: Category.COIN_MINOR }],
    );

    expect(result).toEqual(
      expect.arrayContaining([
        { symbol: 'BTC/KRW', category: Category.COIN_MAJOR },
        { symbol: 'XRP/KRW', category: Category.COIN_MINOR },
      ]),
    );
    expect(result).toHaveLength(2);
  });

  it('should build merged holding save payload with removed symbols excluded', () => {
    const payload = buildMergedHoldingsForSave(
      [
        { symbol: 'BTC/KRW', category: Category.COIN_MAJOR },
        { symbol: 'ETH/KRW', category: Category.COIN_MINOR },
      ],
      [{ symbol: 'ETH/KRW', category: Category.COIN_MINOR }],
      [{ symbol: 'XRP/KRW', category: Category.COIN_MINOR }],
    );

    expect(payload).toEqual([
      { symbol: 'BTC/KRW', category: Category.COIN_MAJOR, index: 0 },
      { symbol: 'XRP/KRW', category: Category.COIN_MINOR, index: 1 },
    ]);
  });
});
