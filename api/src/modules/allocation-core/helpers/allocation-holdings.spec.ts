import { buildCurrentWeightMap, buildOrderableSymbolSet, buildTradableMarketValueMap } from './allocation-holdings';

describe('allocation-holdings utils', () => {
  it('should keep unchecked symbols when orderable validation partially fails', async () => {
    const onAllCheckFailed = jest.fn();
    const onPartialCheck = jest.fn();
    const isSymbolExist = jest
      .fn()
      .mockResolvedValueOnce(true) // AAA/KRW
      .mockRejectedValueOnce(new Error('temporary failure')); // BBB/KRW

    const result = await buildOrderableSymbolSet(['AAA/KRW', 'BBB/KRW'], {
      isSymbolExist,
      onAllCheckFailed,
      onPartialCheck,
    });

    expect(result).toBeInstanceOf(Set);
    expect(result?.has('AAA/KRW')).toBe(true);
    expect(result?.has('BBB/KRW')).toBe(true);
    expect(onAllCheckFailed).not.toHaveBeenCalled();
    expect(onPartialCheck).toHaveBeenCalledTimes(1);
  });

  it('should return undefined when all orderable validations fail', async () => {
    const onAllCheckFailed = jest.fn();
    const onPartialCheck = jest.fn();

    const result = await buildOrderableSymbolSet(['AAA/KRW'], {
      isSymbolExist: jest.fn().mockRejectedValue(new Error('failed')),
      onAllCheckFailed,
      onPartialCheck,
    });

    expect(result).toBeUndefined();
    expect(onAllCheckFailed).toHaveBeenCalledTimes(1);
    expect(onPartialCheck).not.toHaveBeenCalled();
  });

  it('should build current weight map with market price and avg-buy fallback', async () => {
    const balances: any = {
      info: [
        { currency: 'AAA', unit_currency: 'KRW', balance: '2', avg_buy_price: '900' },
        { currency: 'CCC', unit_currency: 'KRW', balance: '3', avg_buy_price: '200' },
        { currency: 'XRP', unit_currency: 'USDT', balance: '1', avg_buy_price: '1000' },
      ],
    };

    const getPrice = jest.fn(async (symbol: string) => {
      if (symbol === 'AAA/KRW') {
        return 1_000;
      }
      throw new Error('price unavailable');
    });

    const weights = await buildCurrentWeightMap(balances, 5_000, getPrice);

    expect(weights.get('AAA/KRW')).toBeCloseTo(0.4);
    expect(weights.get('CCC/KRW')).toBeCloseTo(0.12);
    expect(weights.has('XRP/USDT')).toBe(false);
  });

  it('should build tradable market value map with market price and avg-buy fallback', async () => {
    const balances: any = {
      info: [
        { currency: 'AAA', unit_currency: 'KRW', balance: '2', avg_buy_price: '900' },
        { currency: 'BBB', unit_currency: 'KRW', balance: '3', avg_buy_price: '100' },
        { currency: 'CCC', unit_currency: 'KRW', balance: '5', avg_buy_price: '50' },
      ],
    };

    const getPrice = jest.fn(async (symbol: string) => {
      if (symbol === 'AAA/KRW') {
        return 1_000;
      }
      if (symbol === 'BBB/KRW') {
        throw new Error('price unavailable');
      }
      return 100;
    });

    const values = await buildTradableMarketValueMap(balances, getPrice, new Set(['AAA/KRW', 'BBB/KRW']));

    expect(values.get('AAA/KRW')).toBe(2_000);
    expect(values.get('BBB/KRW')).toBe(300);
    expect(values.has('CCC/KRW')).toBe(false);
  });
});
