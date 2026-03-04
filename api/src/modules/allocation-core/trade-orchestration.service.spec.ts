import { AllocationRecommendation } from '@/modules/allocation/entities/allocation-recommendation.entity';
import { Category } from '@/modules/category/category.enum';
import { OrderTypes } from '@/modules/upbit/upbit.enum';
import { translateKoMessage } from '@/test-utils/i18n.mock';

import { TradeOrchestrationService } from './trade-orchestration.service';
import { RecommendationMetricsErrorService } from './trade-orchestration.types';

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

    it('should normalize expected volatility from percent scale before cost-rate calculation', () => {
      const telemetry = service.deriveTradeCostTelemetry(
        {
          liquidityScore: 8,
          prediction: {
            trendPersistence: 70,
          },
        } as any,
        3,
        1,
      );

      expect(telemetry.impactRate).toBeGreaterThan(0.002);
      expect(telemetry.impactRate).toBeLessThan(0.004);
      expect(telemetry.estimatedCostRate).toBeLessThan(0.01);
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

  describe('included trade request sizing', () => {
    it('should normalize target budget by configured slot count', () => {
      const runtime: any = {
        logger: { log: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {},
      };
      const balances: any = {
        info: [],
      };
      const candidates: any[] = [
        {
          id: 'rec-1',
          batchId: 'batch-1',
          symbol: 'BTC/KRW',
          category: Category.COIN_MAJOR,
          intensity: 1,
          hasStock: true,
          decisionConfidence: 1,
          expectedEdgeRate: 1,
          estimatedCostRate: 0,
        },
        {
          id: 'rec-2',
          batchId: 'batch-1',
          symbol: 'ETH/KRW',
          category: Category.COIN_MAJOR,
          intensity: 1,
          hasStock: true,
          decisionConfidence: 1,
          expectedEdgeRate: 1,
          estimatedCostRate: 0,
        },
      ];

      const withoutSlotCount = service.buildIncludedTradeRequests({
        runtime,
        balances,
        candidates,
        regimeMultiplier: 1,
        currentWeights: new Map<string, number>(),
        marketPrice: 1_000_000,
        calculateTargetWeight: () => 0.5,
      });
      const withSlotCount = service.buildIncludedTradeRequests({
        runtime,
        balances,
        candidates,
        targetSlotCount: 4,
        regimeMultiplier: 1,
        currentWeights: new Map<string, number>(),
        marketPrice: 1_000_000,
        calculateTargetWeight: () => 0.5,
      });

      expect(withoutSlotCount).toHaveLength(2);
      expect(withSlotCount).toHaveLength(2);
      expect(withoutSlotCount[0].diff).toBeCloseTo(0.25, 6);
      expect(withSlotCount[0].diff).toBeCloseTo(0.125, 6);
    });

    it('should resolve user-scoped action threshold on per-slot single-symbol scale', () => {
      const inferences: any[] = [
        {
          id: 'rec-1',
          batchId: 'batch-1',
          symbol: 'BTC/KRW',
          category: Category.COIN_MAJOR,
          intensity: 0.25,
          modelTargetWeight: 0.25,
          action: 'buy',
          hasStock: true,
          decisionConfidence: 0.9,
        },
      ];
      const currentWeights = new Map<string, number>([['BTC/KRW', 0.21]]);

      const holdScoped = service.applyUserScopedRecommendationActions({
        inferences,
        currentWeights,
        targetSlotCount: 1,
      });
      const buyScoped = service.applyUserScopedRecommendationActions({
        inferences,
        currentWeights,
        targetSlotCount: 5,
      });

      expect(holdScoped[0].action).toBe('hold');
      expect(holdScoped[0].modelTargetWeight).toBeCloseTo(0.21, 6);
      expect(buyScoped[0].action).toBe('buy');
      expect(buyScoped[0].modelTargetWeight).toBeCloseTo(0.25, 6);
    });

    it('should recompute buy action from model scores even when persisted action is hold', () => {
      const scoped = service.applyUserScopedRecommendationActions({
        inferences: [
          {
            id: 'rec-xaut',
            batchId: 'batch-1',
            symbol: 'XAUT/KRW',
            category: Category.COIN_MINOR,
            intensity: 0.22,
            buyScore: 0.33519109599999997,
            sellScore: 0.118808904,
            modelTargetWeight: 0.3,
            action: 'hold',
            hasStock: true,
            decisionConfidence: 0.9,
          } as any,
        ],
        currentWeights: new Map<string, number>([['XAUT/KRW', 0.04]]),
        targetSlotCount: 5,
      });

      expect(scoped[0].action).toBe('buy');
      expect(scoped[0].modelTargetWeight).toBeCloseTo(0.33519109599999997, 10);
    });

    it('should recompute buy action from scores when persisted target is zero without sell signal', () => {
      const scoped = service.applyUserScopedRecommendationActions({
        inferences: [
          {
            id: 'rec-btc',
            batchId: 'batch-1',
            symbol: 'BTC/KRW',
            category: Category.COIN_MAJOR,
            intensity: 0.02,
            buyScore: 0.20010280999999996,
            sellScore: 0.11389719000000002,
            modelTargetWeight: 0,
            action: 'hold',
            hasStock: false,
            decisionConfidence: 0.9,
          } as any,
        ],
        currentWeights: new Map<string, number>([['BTC/KRW', 0.0001]]),
        targetSlotCount: 5,
      });

      expect(scoped[0].action).toBe('buy');
      expect(scoped[0].modelTargetWeight).toBeCloseTo(0.20010280999999996, 10);
    });

    it('should recompute partial sell action from user holding delta even when persisted action is buy', () => {
      const scoped = service.applyUserScopedRecommendationActions({
        inferences: [
          {
            id: 'rec-sell',
            batchId: 'batch-1',
            symbol: 'XAUT/KRW',
            category: Category.COIN_MINOR,
            intensity: -0.15,
            buyScore: 0.1,
            sellScore: 0.65,
            modelTargetWeight: 0.1,
            action: 'buy',
            hasStock: true,
            decisionConfidence: 0.9,
          } as any,
        ],
        currentWeights: new Map<string, number>([['XAUT/KRW', 0.2]]),
        targetSlotCount: 5,
      });

      expect(scoped[0].action).toBe('sell');
      expect(scoped[0].modelTargetWeight).toBeCloseTo(0.1, 10);
    });

    it('should not trim hold recommendations that already match current account weight', () => {
      const runtime: any = {
        logger: { log: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {},
      };
      const requests = service.buildNoTradeTrimRequests({
        runtime,
        balances: { info: [] } as any,
        candidates: [
          {
            symbol: 'BTC/KRW',
            category: Category.COIN_MAJOR,
            action: 'hold',
            modelTargetWeight: 0.05,
            decisionConfidence: 0.9,
          } as any,
        ],
        topK: 5,
        regimeMultiplier: 1,
        currentWeights: new Map<string, number>([['BTC/KRW', 0.05]]),
        marketPrice: 1_000_000,
      });

      expect(requests).toHaveLength(0);
    });

    it('should persist current holding weight when sell is downgraded to hold by min threshold', () => {
      const currentWeights = new Map<string, number>([['BTC/KRW', 0.2]]);
      const scoped = service.applyUserScopedRecommendationActions({
        inferences: [
          {
            id: 'rec-hold-sell-downgrade',
            batchId: 'batch-1',
            symbol: 'BTC/KRW',
            category: Category.COIN_MAJOR,
            intensity: 0.18,
            buyScore: 0.18,
            sellScore: 0.7,
            modelTargetWeight: 0.18,
            action: 'sell',
            hasStock: true,
            decisionConfidence: 0.9,
          } as any,
        ],
        currentWeights,
        targetSlotCount: 1,
      });

      expect(scoped[0].action).toBe('hold');
      expect(scoped[0].modelTargetWeight).toBeCloseTo(0.2, 6);

      const runtime: any = {
        logger: { log: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {},
      };
      const requests = service.buildNoTradeTrimRequests({
        runtime,
        balances: { info: [] } as any,
        candidates: scoped,
        topK: 5,
        regimeMultiplier: 1,
        currentWeights,
        marketPrice: 1_000_000,
      });

      expect(requests).toHaveLength(0);
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

      const errorService: RecommendationMetricsErrorService = {
        retryWithFallback: async <T>(operation: () => Promise<T>) => operation(),
      };
      const retryWithFallbackSpy = jest.spyOn(errorService, 'retryWithFallback');
      const onError = jest.fn();
      const items = [
        { symbol: 'BTC/KRW', category: Category.COIN_MAJOR, hasStock: true },
        { symbol: 'ETH/KRW', category: Category.COIN_MAJOR, hasStock: true },
        { symbol: 'BTC/KRW', category: Category.COIN_MAJOR, hasStock: false },
      ];

      const result = await service.buildLatestRecommendationMetricsMap({
        recommendationItems: items,
        errorService,
        onError,
      });

      expect(retryWithFallbackSpy).toHaveBeenCalledTimes(2);
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
            trade: { type: OrderTypes.SELL, filledRatio: 1 },
          },
          {
            request: {
              symbol: 'XRP/KRW',
              diff: -1,
            },
            trade: { type: OrderTypes.SELL, filledRatio: 1 },
          },
          {
            request: {
              symbol: 'ETH/KRW',
              diff: -1,
              inference: { category: Category.COIN_MINOR },
            },
            trade: { type: OrderTypes.SELL, filledRatio: 0.4 },
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

    it('should keep holding ledger entries for partial full-exit sells', () => {
      const result = (service as any).collectLiquidatedHoldingItems(
        [
          {
            request: {
              symbol: 'BTC/KRW',
              diff: -1,
              inference: { category: Category.COIN_MAJOR },
            },
            trade: { type: OrderTypes.SELL, filledRatio: 0.6 },
          },
        ],
        OrderTypes.SELL,
        [{ symbol: 'BTC/KRW', category: Category.COIN_MAJOR }],
      );

      expect(result).toEqual([]);
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

    it('should include inferred hold items even when no trade is executed', () => {
      const payload = (service as any).buildMergedHoldingsForSave(
        [],
        [],
        [],
        [{ symbol: 'XAUT/KRW', category: Category.COIN_MINOR }],
      );

      expect(payload).toEqual([{ symbol: 'XAUT/KRW', category: Category.COIN_MINOR, index: 0 }]);
    });

    it('should build inferred hold items for currently held inferred candidates', () => {
      const items = service.buildInferredHoldingItems({
        candidates: [
          {
            symbol: 'BTC/KRW',
            category: Category.COIN_MAJOR,
          },
          {
            symbol: 'ETH/KRW',
            category: Category.COIN_MAJOR,
          },
          {
            symbol: 'XRP/KRW',
            category: Category.COIN_MINOR,
          },
        ] as any,
        currentWeights: new Map<string, number>([
          ['BTC/KRW', 0.2],
          ['ETH/KRW', 0.05],
          ['XRP/KRW', 0],
        ]),
        regimeMultiplier: 1,
        targetSlotCount: 1,
        calculateTargetWeight: (inference) => (inference.symbol === 'ETH/KRW' ? 0.1 : 0.1),
        orderableSymbols: new Set(['BTC/KRW', 'ETH/KRW', 'XRP/KRW']),
      });

      expect(items).toEqual([
        { symbol: 'BTC/KRW', category: Category.COIN_MAJOR },
        { symbol: 'ETH/KRW', category: Category.COIN_MAJOR },
      ]);
    });

    it('should keep currently held buy/no-trade inferred candidates in hold sync', () => {
      const items = service.buildInferredHoldingItems({
        candidates: [
          {
            symbol: 'BTC/KRW',
            category: Category.COIN_MAJOR,
            action: 'buy',
          },
          {
            symbol: 'ETH/KRW',
            category: Category.COIN_MAJOR,
            action: 'no_trade',
            decisionConfidence: 0.1,
            confidence: 0.1,
          },
          {
            symbol: 'XRP/KRW',
            category: Category.COIN_MAJOR,
            action: 'buy',
          },
        ] as any,
        currentWeights: new Map<string, number>([
          ['BTC/KRW', 0.001],
          ['ETH/KRW', 0.002],
          ['XRP/KRW', 0],
        ]),
        regimeMultiplier: 1,
        targetSlotCount: 5,
        calculateTargetWeight: () => 0.5,
        orderableSymbols: new Set(['BTC/KRW', 'ETH/KRW', 'XRP/KRW']),
      });

      expect(items).toEqual([
        { symbol: 'BTC/KRW', category: Category.COIN_MAJOR },
        { symbol: 'ETH/KRW', category: Category.COIN_MAJOR },
      ]);
    });

    it('should merge inferred hold items from executeRebalanceTrades when no trade runs', async () => {
      const user = { id: 'user-1' } as any;
      const replaceHoldingsForUser = jest.fn().mockResolvedValue([]);
      const holdingLedgerService: any = {
        fetchHoldingsByUser: jest.fn().mockResolvedValue([]),
        replaceHoldingsForUser,
      };
      const notifyService: any = {
        notify: jest.fn(),
        clearClients: jest.fn(),
      };
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          getBalances: jest.fn().mockResolvedValue(null),
          clearClients: jest.fn(),
        },
      };

      const result = await service.executeRebalanceTrades({
        runtime,
        holdingLedgerService,
        notifyService,
        user,
        referenceSymbols: ['XAUT/KRW'],
        initialSnapshot: {
          balances: { info: [] } as any,
          orderableSymbols: new Set(['XAUT/KRW']),
          marketPrice: 1_000_000,
          currentWeights: new Map<string, number>([['XAUT/KRW', 0.1]]),
          tradableMarketValueMap: new Map<string, number>(),
        },
        turnoverCap: 1,
        buildExcludedRequests: () => [],
        buildIncludedRequests: () => [],
        buildNoTradeTrimRequests: () => [],
        buildInferredHoldingItems: () => [{ symbol: 'XAUT/KRW', category: Category.COIN_MINOR }],
      });

      expect(result).toEqual([]);
      expect(replaceHoldingsForUser).toHaveBeenCalledWith(user, [
        { symbol: 'XAUT/KRW', category: Category.COIN_MINOR, index: 0 },
      ]);
    });
  });

  describe('post-only unfilled handling', () => {
    it('should persist trade when post-only order fills after cancel reconciliation', async () => {
      const cancelOrder = jest.fn().mockResolvedValue(undefined);
      const fetchOrder = jest
        .fn()
        .mockResolvedValueOnce({
          id: 'order-123',
          symbol: 'BTC/KRW',
          side: OrderTypes.BUY,
          status: 'open',
          amount: 0.001,
          filled: 0,
          average: null,
          cost: null,
        })
        .mockResolvedValueOnce({
          id: 'order-123',
          symbol: 'BTC/KRW',
          side: OrderTypes.BUY,
          status: 'canceled',
          amount: 0.001,
          filled: 0.001,
          average: 95_000_000,
          cost: 95_000,
        });
      const saveTradeSpy = jest.spyOn(service as any, 'saveTrade').mockResolvedValue({ id: 'trade-1' } as any);
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          adjustOrder: jest.fn().mockResolvedValue({
            order: {
              id: 'order-123',
              side: OrderTypes.BUY,
              status: 'open',
            },
            executionMode: 'limit_post_only',
            orderType: 'limit',
            timeInForce: 'po',
            requestPrice: 100_000_000,
            requestedAmount: 100_000,
            requestedVolume: 0.001,
            filledAmount: 0,
            filledRatio: 0,
            averagePrice: null,
            orderStatus: 'open',
            expectedEdgeRate: 0.01,
            estimatedCostRate: 0.002,
            spreadRate: 0.001,
            impactRate: 0.001,
            gateBypassedReason: null,
            triggerReason: 'included_rebalance',
          }),
          getOrderType: jest.fn().mockReturnValue(OrderTypes.BUY),
          calculateAmount: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(95_000),
          calculateProfit: jest.fn().mockResolvedValue(0),
          fetchOrder,
          cancelOrder,
        },
      };

      const result = await service.executeTrade({
        runtime,
        user: { id: 'user-1' } as any,
        request: {
          symbol: 'BTC/KRW',
          diff: 0.1,
          balances: { info: [] } as any,
        },
      });

      expect(result).not.toBeNull();
      expect(fetchOrder).toHaveBeenCalledTimes(2);
      expect(cancelOrder).toHaveBeenCalledWith({ id: 'user-1' }, 'order-123', 'BTC/KRW');
      expect(saveTradeSpy).toHaveBeenCalledWith(
        { id: 'user-1' },
        expect.objectContaining({
          symbol: 'BTC/KRW',
          amount: 95_000,
          orderStatus: 'canceled',
          filledAmount: 95_000,
          filledRatio: 0.95,
        }),
      );
    });

    it('should persist trade when post-only fill appears after retrying post-cancel refresh', async () => {
      const cancelOrder = jest.fn().mockResolvedValue(undefined);
      const fetchOrder = jest
        .fn()
        .mockResolvedValueOnce({
          id: 'order-123',
          symbol: 'BTC/KRW',
          side: OrderTypes.BUY,
          status: 'open',
          amount: 0.001,
          filled: 0,
          average: null,
          cost: null,
        })
        .mockResolvedValueOnce({
          id: 'order-123',
          symbol: 'BTC/KRW',
          side: OrderTypes.BUY,
          status: 'open',
          amount: 0.001,
          filled: 0,
          average: null,
          cost: null,
        })
        .mockResolvedValueOnce({
          id: 'order-123',
          symbol: 'BTC/KRW',
          side: OrderTypes.BUY,
          status: 'canceled',
          amount: 0.001,
          filled: 0.001,
          average: 95_000_000,
          cost: 95_000,
        });
      const saveTradeSpy = jest.spyOn(service as any, 'saveTrade').mockResolvedValue({ id: 'trade-2' } as any);
      jest.spyOn(service as any, 'waitForPostOnlyReconcileRetry').mockResolvedValue(undefined);
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          adjustOrder: jest.fn().mockResolvedValue({
            order: {
              id: 'order-123',
              side: OrderTypes.BUY,
              status: 'open',
            },
            executionMode: 'limit_post_only',
            orderType: 'limit',
            timeInForce: 'po',
            requestPrice: 100_000_000,
            requestedAmount: 100_000,
            requestedVolume: 0.001,
            filledAmount: 0,
            filledRatio: 0,
            averagePrice: null,
            orderStatus: 'open',
            expectedEdgeRate: 0.01,
            estimatedCostRate: 0.002,
            spreadRate: 0.001,
            impactRate: 0.001,
            gateBypassedReason: null,
            triggerReason: 'included_rebalance',
          }),
          getOrderType: jest.fn().mockReturnValue(OrderTypes.BUY),
          calculateAmount: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(95_000),
          calculateProfit: jest.fn().mockResolvedValue(0),
          fetchOrder,
          cancelOrder,
        },
      };

      const result = await service.executeTrade({
        runtime,
        user: { id: 'user-1' } as any,
        request: {
          symbol: 'BTC/KRW',
          diff: 0.1,
          balances: { info: [] } as any,
        },
      });

      expect(result).not.toBeNull();
      expect(fetchOrder).toHaveBeenCalledTimes(3);
      expect(cancelOrder).toHaveBeenCalledWith({ id: 'user-1' }, 'order-123', 'BTC/KRW');
      expect(saveTradeSpy).toHaveBeenCalledWith(
        { id: 'user-1' },
        expect.objectContaining({
          amount: 95_000,
          filledAmount: 95_000,
          orderStatus: 'canceled',
        }),
      );
    });

    it('should cancel unfilled post-only orders and return null', async () => {
      const cancelOrder = jest.fn().mockResolvedValue(undefined);
      const saveTradeSpy = jest.spyOn(service as any, 'saveTrade');
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          adjustOrder: jest.fn().mockResolvedValue({
            order: {
              id: 'order-123',
              side: OrderTypes.BUY,
              status: 'open',
            },
            executionMode: 'limit_post_only',
            orderType: 'limit',
            timeInForce: 'po',
            requestPrice: 100_000_000,
            requestedAmount: 100_000,
            requestedVolume: 0.001,
            filledAmount: 0,
            filledRatio: 0,
            averagePrice: null,
            orderStatus: 'open',
            expectedEdgeRate: 0.01,
            estimatedCostRate: 0.002,
            spreadRate: 0.001,
            impactRate: 0.001,
            gateBypassedReason: null,
            triggerReason: 'included_rebalance',
          }),
          getOrderType: jest.fn().mockReturnValue(OrderTypes.BUY),
          calculateAmount: jest.fn(),
          calculateProfit: jest.fn(),
          fetchOrder: jest.fn().mockResolvedValue(null),
          cancelOrder,
        },
      };

      const result = await service.executeTrade({
        runtime,
        user: { id: 'user-1' } as any,
        request: {
          symbol: 'BTC/KRW',
          diff: 0.1,
          balances: { info: [] } as any,
        },
      });

      expect(result).toBeNull();
      expect(cancelOrder).toHaveBeenCalledWith({ id: 'user-1' }, 'order-123', 'BTC/KRW');
      expect(saveTradeSpy).not.toHaveBeenCalled();
    });

    it('should continue and return null when post-only reconcile fetch fails after cancel', async () => {
      const cancelOrder = jest.fn().mockResolvedValue(undefined);
      const fetchOrder = jest.fn().mockRejectedValue(new Error('fetch failed'));
      const saveTradeSpy = jest.spyOn(service as any, 'saveTrade');
      jest.spyOn(service as any, 'waitForPostOnlyReconcileRetry').mockResolvedValue(undefined);
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          adjustOrder: jest.fn().mockResolvedValue({
            order: {
              id: 'order-123',
              side: OrderTypes.BUY,
              status: 'open',
            },
            executionMode: 'limit_post_only',
            orderType: 'limit',
            timeInForce: 'po',
            requestPrice: 100_000_000,
            requestedAmount: 100_000,
            requestedVolume: 0.001,
            filledAmount: 0,
            filledRatio: 0,
            averagePrice: null,
            orderStatus: 'open',
            expectedEdgeRate: 0.01,
            estimatedCostRate: 0.002,
            spreadRate: 0.001,
            impactRate: 0.001,
            gateBypassedReason: null,
            triggerReason: 'included_rebalance',
          }),
          getOrderType: jest.fn().mockReturnValue(OrderTypes.BUY),
          calculateAmount: jest.fn(),
          calculateProfit: jest.fn(),
          fetchOrder,
          cancelOrder,
        },
      };

      const result = await service.executeTrade({
        runtime,
        user: { id: 'user-1' } as any,
        request: {
          symbol: 'BTC/KRW',
          diff: 0.1,
          balances: { info: [] } as any,
        },
      });

      expect(result).toBeNull();
      expect(cancelOrder).toHaveBeenCalledWith({ id: 'user-1' }, 'order-123', 'BTC/KRW');
      expect(fetchOrder).toHaveBeenCalledTimes(4);
      expect(runtime.logger.warn).toHaveBeenCalled();
      expect(saveTradeSpy).not.toHaveBeenCalled();
    });

    it('should persist trade when post-only order is filled after exchange refresh', async () => {
      const cancelOrder = jest.fn().mockResolvedValue(undefined);
      const saveTradeSpy = jest.spyOn(service as any, 'saveTrade').mockResolvedValue({ id: 'trade-1' } as any);
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          adjustOrder: jest.fn().mockResolvedValue({
            order: {
              id: 'order-123',
              side: OrderTypes.BUY,
              status: 'open',
            },
            executionMode: 'limit_post_only',
            orderType: 'limit',
            timeInForce: 'po',
            requestPrice: 100_000_000,
            requestedAmount: 100_000,
            requestedVolume: 0.001,
            filledAmount: 0,
            filledRatio: 0,
            averagePrice: null,
            orderStatus: 'open',
            expectedEdgeRate: 0.01,
            estimatedCostRate: 0.002,
            spreadRate: 0.001,
            impactRate: 0.001,
            gateBypassedReason: null,
            triggerReason: 'included_rebalance',
          }),
          getOrderType: jest.fn().mockReturnValue(OrderTypes.BUY),
          calculateAmount: jest.fn().mockResolvedValue(95_000),
          calculateProfit: jest.fn().mockResolvedValue(0),
          fetchOrder: jest.fn().mockResolvedValue({
            id: 'order-123',
            symbol: 'BTC/KRW',
            side: OrderTypes.BUY,
            status: 'closed',
            amount: 0.001,
            filled: 0.001,
            average: 95_000_000,
            cost: 95_000,
          }),
          cancelOrder,
        },
      };

      const result = await service.executeTrade({
        runtime,
        user: { id: 'user-1' } as any,
        request: {
          symbol: 'BTC/KRW',
          diff: 0.1,
          balances: { info: [] } as any,
        },
      });

      expect(result).not.toBeNull();
      expect(cancelOrder).not.toHaveBeenCalled();
      expect(saveTradeSpy).toHaveBeenCalledWith(
        { id: 'user-1' },
        expect.objectContaining({
          symbol: 'BTC/KRW',
          amount: 95_000,
          averagePrice: 95_000_000,
          filledAmount: 95_000,
          filledRatio: 0.95,
          orderStatus: 'closed',
        }),
      );
    });

    it('should skip cancel for finalized post-only order after refresh with no fill', async () => {
      const cancelOrder = jest.fn().mockResolvedValue(undefined);
      const saveTradeSpy = jest.spyOn(service as any, 'saveTrade');
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          adjustOrder: jest.fn().mockResolvedValue({
            order: {
              id: 'order-123',
              side: OrderTypes.BUY,
              status: 'open',
            },
            executionMode: 'limit_post_only',
            orderType: 'limit',
            timeInForce: 'po',
            requestPrice: 100_000_000,
            requestedAmount: 100_000,
            requestedVolume: 0.001,
            filledAmount: 0,
            filledRatio: 0,
            averagePrice: null,
            orderStatus: 'open',
            expectedEdgeRate: 0.01,
            estimatedCostRate: 0.002,
            spreadRate: 0.001,
            impactRate: 0.001,
            gateBypassedReason: null,
            triggerReason: 'included_rebalance',
          }),
          getOrderType: jest.fn().mockReturnValue(OrderTypes.BUY),
          calculateAmount: jest.fn().mockResolvedValue(0),
          calculateProfit: jest.fn().mockResolvedValue(0),
          fetchOrder: jest.fn().mockResolvedValue({
            id: 'order-123',
            symbol: 'BTC/KRW',
            side: OrderTypes.BUY,
            status: 'closed',
            amount: 0.001,
            filled: 0,
            average: null,
            cost: null,
          }),
          cancelOrder,
        },
      };

      const result = await service.executeTrade({
        runtime,
        user: { id: 'user-1' } as any,
        request: {
          symbol: 'BTC/KRW',
          diff: 0.1,
          balances: { info: [] } as any,
        },
      });

      expect(result).toBeNull();
      expect(cancelOrder).not.toHaveBeenCalled();
      expect(saveTradeSpy).not.toHaveBeenCalled();
    });

    it('should persist tracking trade when post-only cancellation fails', async () => {
      const saveTradeSpy = jest.spyOn(service as any, 'saveTrade').mockResolvedValue({ id: 'trade-1' } as any);
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          adjustOrder: jest.fn().mockResolvedValue({
            order: {
              id: 'order-123',
              side: OrderTypes.SELL,
              status: 'open',
            },
            executionMode: 'limit_post_only',
            orderType: 'limit',
            timeInForce: 'po',
            requestPrice: 100_000_000,
            requestedAmount: 100_000,
            requestedVolume: 0.001,
            filledAmount: 0,
            filledRatio: 0,
            averagePrice: null,
            orderStatus: 'open',
            expectedEdgeRate: 0.01,
            estimatedCostRate: 0.002,
            spreadRate: 0.001,
            impactRate: 0.001,
            gateBypassedReason: null,
            triggerReason: null,
          }),
          getOrderType: jest.fn().mockReturnValue(OrderTypes.SELL),
          calculateAmount: jest.fn(),
          calculateProfit: jest.fn(),
          fetchOrder: jest.fn().mockResolvedValue(null),
          cancelOrder: jest.fn().mockRejectedValue(new Error('cancel failed')),
        },
      };

      const result = await service.executeTrade({
        runtime,
        user: { id: 'user-1' } as any,
        request: {
          symbol: 'BTC/KRW',
          diff: -1,
          balances: { info: [] } as any,
        },
      });

      expect(result).toBeNull();
      expect(saveTradeSpy).toHaveBeenCalledWith(
        { id: 'user-1' },
        expect.objectContaining({
          symbol: 'BTC/KRW',
          amount: 0,
          orderStatus: 'open',
          triggerReason: 'post_only_unfilled_cancel_failed',
        }),
      );
    });

    it('should cancel open post-only remainder after partial fill and persist canceled status', async () => {
      const cancelOrder = jest.fn().mockResolvedValue(undefined);
      const saveTradeSpy = jest.spyOn(service as any, 'saveTrade').mockResolvedValue({ id: 'trade-1' } as any);
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          adjustOrder: jest.fn().mockResolvedValue({
            order: {
              id: 'order-123',
              side: OrderTypes.SELL,
              status: 'open',
            },
            executionMode: 'limit_post_only',
            orderType: 'limit',
            timeInForce: 'po',
            requestPrice: 100_000_000,
            requestedAmount: 100_000,
            requestedVolume: 0.001,
            filledAmount: 30_000,
            filledRatio: 0.3,
            averagePrice: 99_500_000,
            orderStatus: 'open',
            expectedEdgeRate: 0.01,
            estimatedCostRate: 0.002,
            spreadRate: 0.001,
            impactRate: 0.001,
            gateBypassedReason: null,
            triggerReason: 'included_rebalance',
          }),
          getOrderType: jest.fn().mockReturnValue(OrderTypes.SELL),
          calculateAmount: jest.fn(),
          calculateProfit: jest.fn().mockResolvedValue(1000),
          fetchOrder: jest.fn().mockResolvedValue(null),
          cancelOrder,
        },
      };

      await service.executeTrade({
        runtime,
        user: { id: 'user-1' } as any,
        request: {
          symbol: 'BTC/KRW',
          diff: -1,
          balances: { info: [] } as any,
        },
      });

      expect(cancelOrder).toHaveBeenCalledWith({ id: 'user-1' }, 'order-123', 'BTC/KRW');
      expect(saveTradeSpy).toHaveBeenCalledWith(
        { id: 'user-1' },
        expect.objectContaining({
          symbol: 'BTC/KRW',
          orderStatus: 'canceled',
          filledRatio: 0.3,
        }),
      );
    });
  });
});
