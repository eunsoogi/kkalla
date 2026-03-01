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
      executionUrgency: 'urgent',
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
      executionUrgency: 'urgent',
    });

    expect(calculateTotalPriceSpy).toHaveBeenCalledWith(balances);
    expect(orderSpy).toHaveBeenCalledTimes(1);

    const [, request] = orderSpy.mock.calls[0];
    expect(request.symbol).toBe('BTC/KRW');
    expect(request.type).toBe(OrderTypes.BUY);
    expect(request.amount).toBeCloseTo(199_900, 6);
  });

  it('should return execution metadata for urgent market adjustment', async () => {
    const user = { id: 'user-1' } as any;
    const balances: any = {
      info: [
        {
          currency: 'KRW',
          unit_currency: 'KRW',
          balance: '1000000',
        },
      ],
      BTC: { free: 0 },
    };

    jest.spyOn(service, 'isSymbolExist').mockResolvedValue(true);
    jest.spyOn(service, 'getPrice').mockResolvedValue(100_000_000);
    jest.spyOn(service, 'calculateTotalPrice').mockReturnValue(1_000_000);
    jest.spyOn(service, 'order').mockResolvedValue({
      side: OrderTypes.BUY,
      status: 'closed',
      cost: 99_950,
      filled: 0.001,
      average: 99_950_000,
    } as any);

    const result = await service.adjustOrder(user, {
      symbol: 'BTC/KRW',
      diff: 0.1,
      balances,
      executionUrgency: 'urgent',
    });

    expect(result.executionMode).toBe('market');
    expect(result.orderType).toBe('market');
    expect(result.requestedAmount).toBeCloseTo(99_950, 6);
    expect(result.filledRatio).toBeCloseTo(1, 6);
    expect(result.order?.side).toBe(OrderTypes.BUY);
  });

  it('should route non-urgent high-edge orders to post-only limit mode', async () => {
    const user = { id: 'user-1' } as any;
    const balances: any = {
      info: [
        {
          currency: 'KRW',
          unit_currency: 'KRW',
          balance: '1000000',
        },
      ],
      BTC: { free: 0 },
    };

    jest.spyOn(service, 'isSymbolExist').mockResolvedValue(true);
    jest.spyOn(service, 'getPrice').mockResolvedValue(100_000_000);
    jest.spyOn(service, 'calculateTotalPrice').mockReturnValue(1_000_000);
    jest.spyOn(service as any, 'estimateOrderCost').mockResolvedValue({
      feeRate: 0.0005,
      spreadRate: 0.0004,
      impactRate: 0.0004,
      estimatedCostRate: 0.0013,
    });
    jest.spyOn(service as any, 'getOrderBook').mockResolvedValue({
      bids: [[99_900_000, 1]],
      asks: [[100_000_000, 1]],
    });
    const orderSpy = jest.spyOn(service, 'order').mockResolvedValue({
      side: OrderTypes.BUY,
      status: 'open',
      cost: 99_950,
      filled: 0.001,
      average: 99_950_000,
    } as any);

    const result = await service.adjustOrder(user, {
      symbol: 'BTC/KRW',
      diff: 0.1,
      balances,
      executionUrgency: 'normal',
      expectedEdgeRate: 0.01,
    });

    expect(orderSpy).toHaveBeenCalledWith(
      user,
      expect.objectContaining({
        executionMode: 'limit_post_only',
        timeInForce: 'po',
        limitPrice: 99_900_000,
      }),
    );
    expect(result.executionMode).toBe('limit_post_only');
    expect(result.orderType).toBe('limit');
    expect(result.timeInForce).toBe('po');
  });

  it('should not infer fill amount from order amount for open post-only orders', async () => {
    const user = { id: 'user-1' } as any;
    const balances: any = {
      info: [
        {
          currency: 'KRW',
          unit_currency: 'KRW',
          balance: '1000000',
        },
      ],
      BTC: { free: 0 },
    };

    jest.spyOn(service, 'isSymbolExist').mockResolvedValue(true);
    jest.spyOn(service, 'getPrice').mockResolvedValue(100_000_000);
    jest.spyOn(service, 'calculateTotalPrice').mockReturnValue(1_000_000);
    jest.spyOn(service as any, 'estimateOrderCost').mockResolvedValue({
      feeRate: 0.0005,
      spreadRate: 0.0004,
      impactRate: 0.0004,
      estimatedCostRate: 0.0013,
    });
    jest.spyOn(service as any, 'getOrderBook').mockResolvedValue({
      bids: [[99_900_000, 1]],
      asks: [[100_000_000, 1]],
    });
    jest.spyOn(service, 'order').mockResolvedValue({
      side: OrderTypes.BUY,
      status: 'open',
      amount: 0.001,
      filled: null,
      cost: null,
      average: null,
    } as any);

    const result = await service.adjustOrder(user, {
      symbol: 'BTC/KRW',
      diff: 0.1,
      balances,
      executionUrgency: 'normal',
      expectedEdgeRate: 0.01,
    });

    expect(result.executionMode).toBe('limit_post_only');
    expect(result.orderStatus).toBe('open');
    expect(result.filledAmount).toBe(0);
    expect(result.filledRatio).toBe(0);
  });

  it('should derive IOC sell remaining volume from cost/average when filled is missing', async () => {
    const user = { id: 'user-1' } as any;
    const balances: any = {
      info: [
        {
          currency: 'KRW',
          unit_currency: 'KRW',
          balance: '1000000',
        },
        {
          currency: 'BTC',
          unit_currency: 'KRW',
          balance: '1',
          avg_buy_price: '90000000',
        },
      ],
      BTC: { free: 1 },
    };

    jest.spyOn(service, 'isSymbolExist').mockResolvedValue(true);
    jest.spyOn(service, 'getPrice').mockResolvedValue(100_000_000);
    jest.spyOn(service, 'calculateTotalPrice').mockReturnValue(100_000_000);
    jest.spyOn(service as any, 'getOrderBook').mockResolvedValue({
      bids: [[99_900_000, 1]],
      asks: [[100_000_000, 1]],
    });
    const orderSpy = jest
      .spyOn(service, 'order')
      .mockResolvedValueOnce({
        side: OrderTypes.SELL,
        status: 'open',
        cost: 3_000_000,
        average: 100_000_000,
        filled: null,
      } as any)
      .mockResolvedValueOnce({
        side: OrderTypes.SELL,
        status: 'closed',
        cost: 7_000_000,
        average: 100_000_000,
        filled: 0.07,
      } as any);

    const result = await service.adjustOrder(user, {
      symbol: 'BTC/KRW',
      diff: -0.1,
      balances,
      executionUrgency: 'normal',
      expectedEdgeRate: 0.002,
      costEstimate: {
        feeRate: 0.0005,
        spreadRate: 0.0004,
        impactRate: 0.0004,
        estimatedCostRate: 0.0013,
      },
    });

    expect(orderSpy).toHaveBeenCalledTimes(2);
    expect(orderSpy.mock.calls[1][1]).toEqual(expect.objectContaining({ executionMode: 'market' }));
    expect(orderSpy.mock.calls[1][1].amount).toBeCloseTo(0.07, 8);
    expect(result.executionMode).toBe('limit_ioc');
    expect(result.filledAmount).toBeCloseTo(10_000_000, 4);
    expect(result.filledRatio).toBeCloseTo(1, 6);
    expect(result.averagePrice).toBeCloseTo(100_000_000, 4);
  });

  it('should derive sell filled ratio from executed volume even when notional is below reference price', async () => {
    const user = { id: 'user-1' } as any;
    const balances: any = {
      info: [
        {
          currency: 'KRW',
          unit_currency: 'KRW',
          balance: '1000000',
        },
        {
          currency: 'BTC',
          unit_currency: 'KRW',
          balance: '1',
          avg_buy_price: '90000000',
        },
      ],
      BTC: { free: 1 },
    };

    jest.spyOn(service, 'isSymbolExist').mockResolvedValue(true);
    jest.spyOn(service, 'getPrice').mockResolvedValue(100_000_000);
    jest.spyOn(service, 'calculateTotalPrice').mockReturnValue(100_000_000);
    jest.spyOn(service, 'order').mockResolvedValue({
      side: OrderTypes.SELL,
      status: 'closed',
      amount: 0.1,
      filled: 0.1,
      cost: 9_000_000,
      average: 90_000_000,
    } as any);

    const result = await service.adjustOrder(user, {
      symbol: 'BTC/KRW',
      diff: -0.1,
      balances,
      executionUrgency: 'urgent',
      expectedEdgeRate: 0.001,
      costEstimate: {
        feeRate: 0.0005,
        spreadRate: 0.0004,
        impactRate: 0.0004,
        estimatedCostRate: 0.0013,
      },
    });

    expect(result.executionMode).toBe('market');
    expect(result.filledAmount).toBeCloseTo(9_000_000, 4);
    expect(result.filledRatio).toBeCloseTo(1, 8);
  });

  it('should not trigger IOC fallback market order when primary IOC placement result is missing', async () => {
    const user = { id: 'user-1' } as any;
    const balances: any = {
      info: [
        {
          currency: 'KRW',
          unit_currency: 'KRW',
          balance: '1000000',
        },
        {
          currency: 'BTC',
          unit_currency: 'KRW',
          balance: '1',
          avg_buy_price: '90000000',
        },
      ],
      BTC: { free: 1 },
    };

    jest.spyOn(service, 'isSymbolExist').mockResolvedValue(true);
    jest.spyOn(service, 'getPrice').mockResolvedValue(100_000_000);
    jest.spyOn(service, 'calculateTotalPrice').mockReturnValue(100_000_000);
    const orderSpy = jest.spyOn(service, 'order').mockResolvedValue(null);

    const result = await service.adjustOrder(user, {
      symbol: 'BTC/KRW',
      diff: -0.1,
      balances,
      executionUrgency: 'normal',
      expectedEdgeRate: 0.002,
      costEstimate: {
        feeRate: 0.0005,
        spreadRate: 0.0004,
        impactRate: 0.0004,
        estimatedCostRate: 0.0013,
      },
    });

    expect(orderSpy).toHaveBeenCalledTimes(1);
    expect(result.executionMode).toBe('limit_ioc');
    expect(result.orderStatus).toBeNull();
    expect(result.filledAmount).toBe(0);
    expect(result.filledRatio).toBe(0);
  });

  it('should pass lowercase timeInForce to exchange limit orders', async () => {
    const createOrder = jest.fn().mockResolvedValue({ id: 'order-1' });
    jest.spyOn(service, 'getClient').mockResolvedValue({ createOrder } as any);
    (service as any).errorService.retry.mockImplementation(async (fn: () => Promise<unknown>) => fn());

    await service.order({ id: 'user-1' } as any, {
      symbol: 'BTC/KRW',
      type: OrderTypes.BUY,
      amount: 100_000,
      executionMode: 'limit_post_only',
      limitPrice: 100_000_000,
      timeInForce: 'po',
    });

    expect(createOrder).toHaveBeenCalledWith(
      'BTC/KRW',
      'limit',
      OrderTypes.BUY,
      expect.any(Number),
      100_000_000,
      expect.objectContaining({
        timeInForce: 'po',
      }),
    );
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
