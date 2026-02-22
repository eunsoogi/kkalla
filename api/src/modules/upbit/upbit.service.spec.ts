import { OrderTypes } from './upbit.enum';
import { UpbitService } from './upbit.service';

describe('UpbitService', () => {
  let service: UpbitService;
  const cacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    cacheService.get.mockResolvedValue(null);
    cacheService.set.mockResolvedValue(undefined);
    service = new UpbitService(
      {
        t: jest.fn((key: string) => key),
      } as any,
      {
        retry: jest.fn(),
        retryWithFallback: jest.fn((fn: () => Promise<unknown>) => fn()),
      } as any,
      {
        notify: jest.fn().mockResolvedValue(undefined),
        notifyServer: jest.fn().mockResolvedValue(undefined),
      } as any,
      cacheService as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should use precomputed marketPrice when it is provided', async () => {
    const user = { id: 'user-1' } as any;
    const balances: any = {
      info: [
        {
          currency: 'KRW',
          unit_currency: 'KRW',
          balance: '1000000',
        },
      ],
      KRW: { free: 1_000_000 },
    };

    jest.spyOn(service, 'isSymbolExist').mockResolvedValue(true);
    jest.spyOn(service, 'getPrice').mockResolvedValue(100_000_000);
    const calculateTotalPriceSpy = jest.spyOn(service, 'calculateTotalPrice');
    const orderSpy = jest.spyOn(service, 'order').mockResolvedValue({ side: OrderTypes.BUY } as any);

    await service.adjustOrder(user, {
      symbol: 'BTC/KRW',
      diff: 0.1,
      balances,
      marketPrice: 1_000_000,
    });

    expect(calculateTotalPriceSpy).not.toHaveBeenCalled();
    expect(orderSpy).toHaveBeenCalledTimes(1);

    const [, request] = orderSpy.mock.calls[0];
    expect(request.symbol).toBe('BTC/KRW');
    expect(request.type).toBe(OrderTypes.BUY);
    expect(request.amount).toBeCloseTo(99_950, 6);
  });

  it('should fallback to calculateTotalPrice when marketPrice is missing', async () => {
    const user = { id: 'user-1' } as any;
    const balances: any = {
      info: [
        {
          currency: 'KRW',
          unit_currency: 'KRW',
          balance: '2000000',
        },
      ],
      KRW: { free: 2_000_000 },
    };

    jest.spyOn(service, 'isSymbolExist').mockResolvedValue(true);
    jest.spyOn(service, 'getPrice').mockResolvedValue(100_000_000);
    const calculateTotalPriceSpy = jest.spyOn(service, 'calculateTotalPrice').mockReturnValue(2_000_000);
    const orderSpy = jest.spyOn(service, 'order').mockResolvedValue({ side: OrderTypes.BUY } as any);

    await service.adjustOrder(user, {
      symbol: 'BTC/KRW',
      diff: 0.1,
      balances,
    });

    expect(calculateTotalPriceSpy).toHaveBeenCalledWith(balances);
    expect(orderSpy).toHaveBeenCalledTimes(1);

    const [, request] = orderSpy.mock.calls[0];
    expect(request.symbol).toBe('BTC/KRW');
    expect(request.type).toBe(OrderTypes.BUY);
    expect(request.amount).toBeCloseTo(199_900, 6);
  });

  it('should skip non-orderable symbols when calculating tradable market value with filter set', async () => {
    const balances: any = {
      info: [
        {
          currency: 'KRW',
          unit_currency: 'KRW',
          balance: '10000',
        },
        {
          currency: 'SGB',
          unit_currency: 'KRW',
          balance: '50',
          avg_buy_price: '100',
        },
      ],
    };

    const getPriceSpy = jest.spyOn(service, 'getPrice').mockResolvedValue(1_000);

    const marketValue = await service.calculateTradableMarketValue(balances, new Set(['BTC/KRW']));

    expect(getPriceSpy).not.toHaveBeenCalled();
    expect(marketValue).toBe(10_000);
  });

  it('should cache missing minute candle with short ttl', async () => {
    const time = new Date('2026-02-22T12:34:56.000Z');
    const minuteStartMs = Math.floor(time.getTime() / 60_000) * 60_000;
    const cacheKey = `upbit:minute-open:BTC/KRW:${minuteStartMs}`;
    const client = {
      fetchOHLCV: jest.fn().mockResolvedValue([]),
    };

    jest.spyOn(service, 'getServerClient').mockResolvedValue(client as any);
    cacheService.get.mockResolvedValue(null);

    const result = await service.getMinuteCandleAt('BTC/KRW', time);

    expect(result).toBeUndefined();
    expect(cacheService.set).toHaveBeenCalledWith(cacheKey, { value: null }, 60);
  });

  it('should cache minute candle open with long ttl', async () => {
    const time = new Date('2026-02-22T12:34:56.000Z');
    const minuteStartMs = Math.floor(time.getTime() / 60_000) * 60_000;
    const cacheKey = `upbit:minute-open:BTC/KRW:${minuteStartMs}`;
    const client = {
      fetchOHLCV: jest.fn().mockResolvedValue([[minuteStartMs, 123, 0, 0, 0]]),
    };

    jest.spyOn(service, 'getServerClient').mockResolvedValue(client as any);
    cacheService.get.mockResolvedValue(null);

    const result = await service.getMinuteCandleAt('BTC/KRW', time);

    expect(result).toBe(123);
    expect(cacheService.set).toHaveBeenCalledWith(cacheKey, { value: 123 }, 60 * 60 * 24);
  });
});
