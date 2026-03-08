import { translateKoMessage } from '@/test-utils/i18n.mock';

import { OrderTypes } from './upbit.enum';
import { UpbitService } from './upbit.service';

describe('UpbitService', () => {
  let service: UpbitService;
  const errorService = {
    retry: jest.fn(),
    retryWithFallback: jest.fn((fn: () => Promise<unknown>) => fn()),
    getErrorMessage: jest.fn((error: unknown) => {
      if (error instanceof Error) {
        return error.message;
      }
      return typeof error === 'string' ? error : JSON.stringify(error);
    }),
  };
  const cacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };
  const tradeCostCalibrationService = {
    resolveCostTier: jest.fn((nonFeeCostRate: number) => {
      if (nonFeeCostRate < 0.001) return 'low';
      if (nonFeeCostRate < 0.0025) return 'medium';
      return 'high';
    }),
    resolveBuyGateCalibration: jest.fn().mockResolvedValue({
      calibrationApplied: false,
      calibrationReason: 'missing',
      bucketKey: null,
      staticNonFeeCostRate: null,
      rawMultiplier: null,
      appliedMultiplier: 1,
      calibratedEstimatedCostRate: null,
    }),
  };

  beforeEach(() => {
    errorService.retry.mockReset();
    errorService.retryWithFallback.mockReset();
    errorService.retry.mockImplementation((fn: () => Promise<unknown>) => fn());
    errorService.retryWithFallback.mockImplementation((fn: () => Promise<unknown>) => fn());
    errorService.getErrorMessage.mockClear();
    cacheService.get.mockResolvedValue(null);
    cacheService.set.mockResolvedValue(undefined);
    tradeCostCalibrationService.resolveBuyGateCalibration.mockClear();
    tradeCostCalibrationService.resolveCostTier.mockClear();
    tradeCostCalibrationService.resolveBuyGateCalibration.mockResolvedValue({
      calibrationApplied: false,
      calibrationReason: 'missing',
      bucketKey: null,
      staticNonFeeCostRate: null,
      rawMultiplier: null,
      appliedMultiplier: 1,
      calibratedEstimatedCostRate: null,
    });
    service = new UpbitService(
      {
        t: jest.fn(translateKoMessage),
      } as any,
      errorService as any,
      {
        notify: jest.fn().mockResolvedValue(undefined),
        notifyServer: jest.fn().mockResolvedValue(undefined),
      } as any,
      cacheService as any,
      tradeCostCalibrationService as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should not infer executed notional from open order amount only', async () => {
    const getServerClientSpy = jest.spyOn(service, 'getServerClient');

    const amount = await service.calculateAmount({
      symbol: 'BTC/KRW',
      status: 'open',
      amount: 0.1,
      filled: null,
      cost: null,
      average: null,
    } as any);

    expect(amount).toBe(0);
    expect(getServerClientSpy).not.toHaveBeenCalled();
  });

  it('should fallback to amount*price when finalized order has no executed notional', async () => {
    const fetchTicker = jest.fn().mockResolvedValue({ last: 100_000_000 });
    jest.spyOn(service, 'getServerClient').mockResolvedValue({ fetchTicker } as any);

    const amount = await service.calculateAmount({
      symbol: 'BTC/KRW',
      status: 'closed',
      amount: 0.001,
      filled: null,
      cost: null,
      average: null,
    } as any);

    expect(amount).toBeCloseTo(100_000, 8);
    expect(fetchTicker).toHaveBeenCalledWith('BTC/KRW');
  });

  it('should fetch latest order when exchange client supports fetchOrder', async () => {
    const fetchOrder = jest.fn().mockResolvedValue({
      id: 'order-1',
      symbol: 'BTC/KRW',
      status: 'closed',
    });
    jest.spyOn(service, 'getClient').mockResolvedValue({ fetchOrder } as any);

    const order = await service.fetchOrder({ id: 'user-1' } as any, 'order-1', 'BTC/KRW');

    expect(order).toEqual(expect.objectContaining({ id: 'order-1', status: 'closed' }));
    expect(fetchOrder).toHaveBeenCalledWith('order-1', 'BTC/KRW');
  });

  it('should propagate cancelOrder done_order errors to trade orchestration layer', async () => {
    const cancelOrder = jest
      .fn()
      .mockRejectedValue(new Error('upbit {"error":{"name":"done_order","message":"이미 체결된 주문입니다."}}'));
    jest.spyOn(service, 'getClient').mockResolvedValue({ cancelOrder } as any);
    errorService.retryWithFallback.mockImplementation(async (fn: () => Promise<unknown>) => fn());

    await expect(service.cancelOrder({ id: 'user-1' } as any, 'order-1', 'BTC/KRW')).rejects.toThrow('done_order');
    expect(cancelOrder).toHaveBeenCalledWith('order-1', 'BTC/KRW');
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

    expect(result.requestPrice).toBeCloseTo(100_000_000, 4);
    expect(result.requestedAmount).toBeCloseTo(99_950, 6);
    expect(result.filledAmount).toBeCloseTo(99_950, 6);
    expect(result.order?.side).toBe(OrderTypes.BUY);
  });

  it('should execute non-urgent high-edge orders in market mode', async () => {
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
    const orderSpy = jest.spyOn(service, 'order').mockResolvedValue({
      side: OrderTypes.BUY,
      status: 'open',
      cost: 99_950,
      filled: 0.001,
      average: 99_950_000,
    } as any);

    await service.adjustOrder(user, {
      symbol: 'BTC/KRW',
      diff: 0.1,
      balances,
      executionUrgency: 'normal',
      expectedEdgeRate: 0.01,
    });

    expect(orderSpy).toHaveBeenCalledWith(user, expect.objectContaining({ type: OrderTypes.BUY }));
  });

  it('should tighten only the normal buy gate when calibrated cost is higher than static cost', async () => {
    const user = { id: 'user-1' } as any;
    const balances: any = {
      info: [{ currency: 'KRW', unit_currency: 'KRW', balance: '1000000' }],
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
    const orderSpy = jest.spyOn(service, 'order').mockResolvedValue({
      side: OrderTypes.BUY,
      status: 'open',
      cost: 99_950,
      filled: 0.001,
      average: 99_950_000,
    } as any);
    tradeCostCalibrationService.resolveBuyGateCalibration.mockResolvedValueOnce({
      calibrationApplied: true,
      calibrationReason: 'active',
      bucketKey: 'coin_major:low:existing:live',
      staticNonFeeCostRate: 0.0008,
      rawMultiplier: 1.5,
      appliedMultiplier: 1.5,
      calibratedEstimatedCostRate: 0.0017,
    });

    const result = await service.adjustOrder(user, {
      symbol: 'BTC/KRW',
      diff: 0.1,
      balances,
      executionUrgency: 'normal',
      expectedEdgeRate: 0.002,
    });

    expect(orderSpy).not.toHaveBeenCalled();
    expect(result.order).toBeNull();
    expect(result.estimatedCostRate).toBeCloseTo(0.0017, 10);
  });

  it('should override calibration cost tier from live spread and impact before lookup', async () => {
    const user = { id: 'user-1' } as any;
    const balances: any = {
      info: [{ currency: 'KRW', unit_currency: 'KRW', balance: '1000000' }],
      BTC: { free: 0 },
    };

    jest.spyOn(service, 'isSymbolExist').mockResolvedValue(true);
    jest.spyOn(service, 'getPrice').mockResolvedValue(100_000_000);
    jest.spyOn(service, 'calculateTotalPrice').mockReturnValue(1_000_000);
    jest.spyOn(service as any, 'estimateOrderCost').mockResolvedValue({
      feeRate: 0.0005,
      spreadRate: 0.0016,
      impactRate: 0.0012,
      estimatedCostRate: 0.0033,
    });
    jest.spyOn(service, 'order').mockResolvedValue({
      side: OrderTypes.BUY,
      status: 'open',
      cost: 99_950,
      filled: 0.001,
      average: 99_950_000,
    } as any);

    await service.adjustOrder(user, {
      symbol: 'BTC/KRW',
      diff: 0.1,
      balances,
      executionUrgency: 'normal',
      expectedEdgeRate: 0.01,
      costCalibrationContext: {
        category: 'coin_major' as any,
        costTier: 'low',
        positionClass: 'existing',
        regimeSource: 'live',
      },
    });

    expect(tradeCostCalibrationService.resolveBuyGateCalibration).toHaveBeenCalledWith(
      expect.objectContaining({
        calibrationContext: expect.objectContaining({
          category: 'coin_major',
          costTier: 'high',
          positionClass: 'existing',
          regimeSource: 'live',
        }),
      }),
    );
  });

  it('should keep empty fill metadata for open market orders with missing fill metadata', async () => {
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

    expect(result.filledAmount).toBeNull();
  });

  it('should fallback to requested notional when finalized market order misses fill metadata', async () => {
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
    jest.spyOn(service, 'order').mockResolvedValue({
      side: OrderTypes.BUY,
      status: 'closed',
      amount: null,
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

    expect(result.filledAmount).toBeCloseTo(99_950, 6);
  });

  it('should derive sell filled amount from cost/average when filled is missing', async () => {
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
    const orderSpy = jest.spyOn(service, 'order').mockResolvedValue({
      side: OrderTypes.SELL,
      status: 'open',
      cost: 3_000_000,
      average: 100_000_000,
      filled: null,
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

    expect(orderSpy).toHaveBeenCalledTimes(1);
    expect(result.filledAmount).toBeCloseTo(3_000_000, 4);
    expect(result.averagePrice).toBeCloseTo(100_000_000, 4);
  });

  it('should derive sell filled amount from executed volume even when notional is below reference price', async () => {
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

    expect(result.filledAmount).toBeCloseTo(9_000_000, 4);
  });

  it('should keep empty fill metadata when market placement result is missing', async () => {
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
    expect(result.filledAmount).toBeNull();
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
