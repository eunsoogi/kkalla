import { AllocationRecommendation } from '@/modules/allocation/entities/allocation-recommendation.entity';
import { Category } from '@/modules/category/category.enum';
import { OrderTypes } from '@/modules/upbit/upbit.enum';

import { TradeOrchestrationService } from './trade-orchestration.service';

describe('TradeOrchestrationService', () => {
  let service: TradeOrchestrationService;

  beforeEach(() => {
    service = new TradeOrchestrationService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('market regime', () => {
    it('should map fear-greed values to multipliers', () => {
      expect(service.getMarketRegimeMultiplierByFearGreedIndex(10)).toBe(0.95);
      expect(service.getMarketRegimeMultiplierByFearGreedIndex(30)).toBe(0.97);
      expect(service.getMarketRegimeMultiplierByFearGreedIndex(50)).toBe(1);
      expect(service.getMarketRegimeMultiplierByFearGreedIndex(70)).toBe(0.99);
      expect(service.getMarketRegimeMultiplierByFearGreedIndex(90)).toBe(0.97);
    });

    it('should fallback to 1 for non-finite values', () => {
      expect(service.getMarketRegimeMultiplierByFearGreedIndex(Number.NaN)).toBe(1);
    });

    it('should resolve multiplier from reader and fallback on failure', async () => {
      const resolved = await service.resolveMarketRegimeMultiplier(async () => ({
        feargreed: { index: 80 },
      }));
      expect(resolved).toBe(0.97);

      const fallback = await service.resolveMarketRegimeMultiplier(async () => {
        throw new Error('failed');
      });
      expect(fallback).toBe(1);
    });

    it('should calculate market signal adjustment in a conservative range', () => {
      expect(service.getMarketRegimeMultiplierAdjustmentByMarketSignals(60, 20)).toBe(-0.03);
      expect(service.getMarketRegimeMultiplierAdjustmentByMarketSignals(45, 80)).toBe(0.03);
      expect(service.getMarketRegimeMultiplierAdjustmentByMarketSignals(52, 55)).toBe(0);
    });

    it('should apply market signal adjustment on top of fear-greed multiplier', async () => {
      const adjusted = await service.resolveMarketRegimeMultiplier(async () => ({
        feargreed: { index: 50 },
        btcDominance: 60,
        altcoinIndex: 20,
      }));
      expect(adjusted).toBe(0.97);
    });

    it('should resolve extended regime policy with defensive scaling', async () => {
      const policy = await service.resolveMarketRegimePolicy(async () => ({
        feargreed: { index: 15 },
        btcDominance: 62,
        altcoinIndex: 18,
      }));

      expect(policy.exposureMultiplier).toBeLessThan(1);
      expect(policy.rebalanceBandMultiplier).toBeGreaterThan(1);
      expect(policy.turnoverCap).toBeLessThan(0.55);
      expect(policy.categoryExposureCaps.coinMajor).toBeGreaterThan(policy.categoryExposureCaps.coinMinor);
      expect(policy.categoryExposureCaps.coinMinor).toBeLessThan(0.45);
    });
  });

  describe('holdings snapshot helpers', () => {
    it('should keep unchecked symbols when orderable validation partially fails', async () => {
      const onAllCheckFailed = jest.fn();
      const onPartialCheck = jest.fn();
      const isSymbolExist = jest.fn().mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('temporary failure'));

      const result = await service.buildOrderableSymbolSet(['AAA/KRW', 'BBB/KRW'], {
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

      const result = await service.buildOrderableSymbolSet(['AAA/KRW'], {
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

      const weights = await service.buildCurrentWeightMap(balances, 5_000, getPrice);

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

      const values = await service.buildTradableMarketValueMap(balances, getPrice, new Set(['AAA/KRW', 'BBB/KRW']));

      expect(values.get('AAA/KRW')).toBe(2_000);
      expect(values.get('BBB/KRW')).toBe(300);
      expect(values.has('CCC/KRW')).toBe(false);
    });
  });

  describe('trade telemetry and liquidation requests', () => {
    it('should normalize trend persistence from 0-100 scale before edge-rate calculation', () => {
      const telemetry = service.deriveTradeCostTelemetry(
        {
          liquidityScore: 8,
          prediction: {
            trendPersistence: 70,
          },
        } as any,
        0.12,
        1,
      );

      expect(telemetry.expectedEdgeRate).toBeCloseTo(0.4, 10);
    });

    it('should build missing-inference sell requests as full liquidation', () => {
      const balances: any = {
        info: [
          { currency: 'KRW', unit_currency: 'KRW', balance: '1000000' },
          { currency: 'BTC', unit_currency: 'KRW', balance: '0.1' },
        ],
      };

      const requests = service.buildMissingInferenceSellRequests({
        balances,
        inferences: [],
        marketPrice: 1000000,
      });

      expect(requests).toHaveLength(1);
      expect(requests[0].symbol).toBe('BTC/KRW');
      expect(requests[0].diff).toBe(-1);
    });
  });

  describe('latest recommendation metrics', () => {
    it('should build latest metrics map from latest recommendations per unique symbol', async () => {
      const findSpy = jest.spyOn(AllocationRecommendation, 'find');
      findSpy
        .mockResolvedValueOnce([
          {
            intensity: 0.2,
            modelTargetWeight: 0.3,
          } as AllocationRecommendation,
        ])
        .mockResolvedValueOnce([
          {
            intensity: 0.6,
            modelTargetWeight: 0.7,
          } as AllocationRecommendation,
        ]);

      const retryWithFallback = jest.fn(async <T>(operation: () => Promise<T>) => operation());
      const onError = jest.fn();
      const items = [
        { symbol: 'BTC/KRW', category: Category.COIN_MAJOR, hasStock: true },
        { symbol: 'ETH/KRW', category: Category.COIN_MAJOR, hasStock: true },
        { symbol: 'BTC/KRW', category: Category.COIN_MAJOR, hasStock: false },
      ];

      const result = await service.buildLatestRecommendationMetricsMap({
        recommendationItems: items,
        errorService: { retryWithFallback },
        onError,
      });

      expect(retryWithFallback).toHaveBeenCalledTimes(2);
      expect(findSpy).toHaveBeenCalledTimes(2);
      expect(result.get('BTC/KRW')).toEqual({ intensity: 0.2, modelTargetWeight: 0.3 });
      expect(result.get('ETH/KRW')).toEqual({ intensity: 0.6, modelTargetWeight: 0.7 });
      expect(onError).not.toHaveBeenCalled();
    });

    it('should keep null metrics and call onError when recommendation fetch fails', async () => {
      const error = new Error('failed');
      const retryWithFallback = jest.fn().mockRejectedValue(error);
      const onError = jest.fn();
      const items = [{ symbol: 'XRP/KRW', category: Category.COIN_MINOR, hasStock: false }];

      const result = await service.buildLatestRecommendationMetricsMap({
        recommendationItems: items,
        errorService: { retryWithFallback },
        onError,
      });

      expect(onError).toHaveBeenCalledWith(error);
      expect(result.get('XRP/KRW')).toEqual({ intensity: null, modelTargetWeight: null });
    });
  });

  describe('category exposure cap', () => {
    it('should resolve category exposure cap with fallback defaults', () => {
      expect(service.resolveCategoryExposureCap(Category.COIN_MAJOR)).toBe(1);
      expect(
        service.resolveCategoryExposureCap(Category.COIN_MAJOR, {
          coinMajor: 0.7,
          coinMinor: 0.2,
          nasdaq: 0.3,
        }),
      ).toBeCloseTo(0.7, 10);
      expect(
        service.resolveCategoryExposureCap(Category.COIN_MINOR, {
          coinMajor: 0.7,
          coinMinor: 0.2,
          nasdaq: 0.3,
        }),
      ).toBeCloseTo(0.2, 10);
      expect(
        service.resolveCategoryExposureCap(Category.NASDAQ, {
          coinMajor: 0.7,
          coinMinor: 0.2,
          nasdaq: 0.3,
        }),
      ).toBeCloseTo(0.3, 10);
    });

    it('should defer category cap consumption until commit', () => {
      const categoryAllocatedTargetWeight = new Map<Category, number>();

      const first = service.allocateCategoryCappedTargetWeight({
        category: Category.COIN_MINOR,
        uncappedTargetWeight: 0.2,
        categoryAllocatedTargetWeight,
        categoryExposureCaps: {
          coinMajor: 0.7,
          coinMinor: 0.2,
          nasdaq: 0.3,
        },
      });
      expect(first.targetWeight).toBeCloseTo(0.2, 10);
      expect(categoryAllocatedTargetWeight.get(Category.COIN_MINOR)).toBeUndefined();

      first.commit();
      expect(categoryAllocatedTargetWeight.get(Category.COIN_MINOR)).toBeCloseTo(0.2, 10);

      const second = service.allocateCategoryCappedTargetWeight({
        category: Category.COIN_MINOR,
        uncappedTargetWeight: 0.2,
        categoryAllocatedTargetWeight,
        categoryExposureCaps: {
          coinMajor: 0.7,
          coinMinor: 0.2,
          nasdaq: 0.3,
        },
      });
      expect(second.targetWeight).toBeCloseTo(0, 10);
    });
  });

  describe('holding ledger merge helpers', () => {
    it('should collect unique executed buy holding items only', () => {
      const result = (service as any).collectExecutedBuyHoldingItems(
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
      const result = (service as any).collectLiquidatedHoldingItems(
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
      const payload = (service as any).buildMergedHoldingsForSave(
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
});
