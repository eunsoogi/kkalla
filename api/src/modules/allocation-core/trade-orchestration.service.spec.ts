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

  describe('trade reason localization', () => {
    it('should localize known trigger reasons using i18n labels', () => {
      const i18n: any = { t: jest.fn(translateKoMessage) };

      const localized = (service as any).resolveTradeTriggerReasonLabel(i18n, 'included_rebalance');

      expect(localized).toBe('리밸런싱 포함 종목');
    });

    it('should fallback to raw reason when translation key is missing', () => {
      const i18n: any = { t: jest.fn(translateKoMessage) };

      const localized = (service as any).resolveTradeTriggerReasonLabel(i18n, 'custom_trigger_reason');

      expect(localized).toBe('custom_trigger_reason');
    });

    it('should localize known gate bypass reasons using i18n labels', () => {
      const i18n: any = { t: jest.fn(translateKoMessage) };

      const localized = (service as any).resolveTradeGateBypassedReasonLabel(i18n, 'urgent_risk_reduction');

      expect(localized).toBe('긴급 리스크 축소 우선');
    });

    it('should fallback to dash when reason is empty', () => {
      const i18n: any = { t: jest.fn(translateKoMessage) };

      expect((service as any).resolveTradeTriggerReasonLabel(i18n, null)).toBe('-');
      expect((service as any).resolveTradeGateBypassedReasonLabel(i18n, undefined)).toBe('-');
    });

    it('should render trade notification text in plain language for conservative mode', () => {
      const i18n: any = { t: jest.fn(translateKoMessage) };
      const trade: any = {
        amount: 120000,
        decisionRegimeSource: 'unavailable_risk_off',
        decisionRequestedTradeNotional: 120000,
        decisionCappedTradeNotional: 120000,
        gateBypassedReason: null,
        triggerReason: 'included_rebalance',
      };

      const whatHappened = (service as any).resolveTradeNotificationWhatHappened(i18n, trade);
      const why = (service as any).resolveTradeNotificationWhy(i18n, trade);

      expect(whatHappened).toContain('120,000');
      expect(why).toBe('시장 상황 정보가 부족해 보수적으로 처리했습니다.');
      expect(why).not.toContain('calibration');
      expect(why).not.toContain('bucket');
    });

    it('should render trade notification text for reduced execution without technical jargon', () => {
      const i18n: any = { t: jest.fn(translateKoMessage) };
      const trade: any = {
        amount: 80000,
        decisionRequestedTradeNotional: 120000,
        decisionCappedTradeNotional: 80000,
        decisionRegimeSource: 'live',
        gateBypassedReason: null,
        triggerReason: 'included_rebalance',
      };

      const whatHappened = (service as any).resolveTradeNotificationWhatHappened(i18n, trade);
      const why = (service as any).resolveTradeNotificationWhy(i18n, trade);

      expect(whatHappened).toBe('80,000원어치만 실행했습니다.');
      expect(why).toBe('한 번에 너무 많이 움직이지 않도록 주문 크기를 줄였습니다.');
    });
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

    it('should expose explicit regimeUnavailable policy state on regime read failure', async () => {
      const policy = await service.resolveMarketRegimePolicy(async () => {
        throw new Error('failed');
      });

      expect(policy.regimePolicyState).toBe('regimeUnavailable');
      expect(policy.regimePolicySource).toBe('unavailable_risk_off');
    });

    it('should preserve unavailable risk-off source when reader returns degraded snapshot', async () => {
      const policy = await service.resolveMarketRegimePolicy(async () => ({
        btcDominance: 55,
        altcoinIndex: 50,
        source: 'unavailable_risk_off',
        feargreed: null,
      }));

      expect(policy.regimePolicyState).toBe('regimeUnavailable');
      expect(policy.regimePolicySource).toBe('unavailable_risk_off');
      expect(policy.exposureMultiplier).toBe(1);
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

    it('should keep weight numerator aligned with tradable denominator mode', async () => {
      const balances: any = {
        info: [{ currency: 'AAA', unit_currency: 'KRW', balance: '1', locked: '2', avg_buy_price: '1000' }],
      };

      const getPrice = jest.fn(async () => 1_000);
      const weights = await service.buildCurrentWeightMap(balances, 1_000, getPrice, undefined, false);

      expect(weights.get('AAA/KRW')).toBeCloseTo(1);
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

    it('should derive snapshot market value from exchange total market-value API', async () => {
      const balances: any = {
        info: [
          { currency: 'KRW', unit_currency: 'KRW', balance: '5000' },
          { currency: 'AAA', unit_currency: 'KRW', balance: '1', locked: '1', avg_buy_price: '900' },
        ],
      };
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          calculateTotalMarketValue: jest.fn().mockResolvedValue(7_000),
          isSymbolExist: jest.fn().mockResolvedValue(true),
          getPrice: jest.fn(async (symbol: string) => {
            if (symbol === 'AAA/KRW') {
              return 1_000;
            }
            throw new Error('price unavailable');
          }),
        },
      };

      const snapshot = await service.buildTradeExecutionSnapshot({
        runtime,
        balances,
        referenceSymbols: ['AAA/KRW'],
      });

      expect(snapshot.marketPrice).toBe(7_000);
      expect(snapshot.currentWeights.get('AAA/KRW')).toBeCloseTo(2_000 / 7_000);
    });

    it('should fallback to exchange total-price estimator when market-value APIs are unavailable', async () => {
      const balances: any = {
        info: [
          { currency: 'KRW', unit_currency: 'KRW', balance: '5000' },
          { currency: 'AAA', unit_currency: 'KRW', balance: '1', locked: '1', avg_buy_price: '900' },
        ],
      };
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          calculateTotalPrice: jest.fn().mockReturnValue(6_000),
          isSymbolExist: jest.fn().mockResolvedValue(true),
          getPrice: jest.fn(async (symbol: string) => {
            if (symbol === 'AAA/KRW') {
              return 1_000;
            }
            throw new Error('price unavailable');
          }),
        },
      };

      const snapshot = await service.buildTradeExecutionSnapshot({
        runtime,
        balances,
        referenceSymbols: ['AAA/KRW'],
      });

      expect(snapshot.marketPrice).toBe(6_000);
      expect(snapshot.currentWeights.get('AAA/KRW')).toBeCloseTo(1_000 / 6_000);
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
      expect(requests[0].forcedFullLiquidation).toBe(true);
      expect(requests[0].cappedTradeDiff).toBe(-1);
    });

    it('should not infer execution from requested amount while order is still open', async () => {
      const metrics = await (service as any).resolveTradeExecutionFillMetrics({
        adjustedRequestedAmount: 100_000,
        adjustedFilledAmount: 0,
        orderStatus: 'open',
        resolveFallbackFilledAmount: jest.fn().mockResolvedValue(0),
      });

      expect(metrics.hasExecutedFill).toBe(false);
      expect(metrics.filledAmount).toBe(0);
    });

    it('should infer execution from requested amount when order is finalized and fill metadata is missing', async () => {
      const metrics = await (service as any).resolveTradeExecutionFillMetrics({
        adjustedRequestedAmount: 100_000,
        adjustedFilledAmount: 0,
        orderStatus: 'closed',
        resolveFallbackFilledAmount: jest.fn().mockResolvedValue(0),
      });

      expect(metrics.hasExecutedFill).toBe(true);
      expect(metrics.filledAmount).toBe(100_000);
    });

    it('should derive realized cost rate and calibration coefficient from request and fill prices', () => {
      const realizedCostRate = (service as any).resolveRealizedCostRate(OrderTypes.BUY, 100, 101, 0.003, 0.001, 0.0015);
      const calibrationCoefficient = (service as any).resolveCostCalibrationCoefficient(realizedCostRate, 0.003);

      expect(realizedCostRate).toBeCloseTo(0.0105, 10);
      expect(calibrationCoefficient).toBeCloseTo(0.0105 / 0.003, 10);
    });

    it('should reconcile open market orders with fetchOrder before deciding execution failure', async () => {
      const runtime: any = {
        logger: { warn: jest.fn() },
        exchangeService: {
          fetchOrder: jest
            .fn()
            .mockResolvedValueOnce({ id: 'order-1', status: 'open', amount: 1, filled: 0 })
            .mockResolvedValueOnce({ id: 'order-1', status: 'closed', amount: 1, filled: 1 }),
          calculateAmount: jest.fn(async (order: any) => (order?.status === 'closed' ? 100_000 : 0)),
        },
      };

      const reconciled = await (service as any).reconcileOpenMarketOrderFillMetrics({
        runtime,
        user: { id: 'user-1' },
        symbol: 'BTC/KRW',
        orderId: 'order-1',
        adjustedRequestedAmount: 100_000,
        requestRequestedAmount: 100_000,
        requestedAmount: 100_000,
        requestedVolume: 1,
        filledVolume: 0,
      });

      expect(runtime.exchangeService.fetchOrder).toHaveBeenCalledTimes(2);
      expect(reconciled).not.toBeNull();
      expect(reconciled?.hasExecutedFill).toBe(true);
      expect(reconciled?.filledAmount).toBe(100_000);
      expect(reconciled?.filledVolume).toBe(1);
    });

    it('should reconcile market order fills even when initial status is unknown', async () => {
      const placedOrder: any = {
        id: 'order-1',
        status: null,
        type: 'market',
        amount: 1,
        filled: 0,
        average: null,
        cost: null,
        info: { ord_type: 'price' },
      };
      const closedOrder: any = {
        ...placedOrder,
        status: 'closed',
        filled: 1,
        average: 100_000,
        cost: 100_000,
      };
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn((key: string) => key) },
        exchangeService: {
          adjustOrder: jest.fn().mockResolvedValue({
            order: placedOrder,
            requestPrice: null,
            requestedAmount: 100_000,
            requestedVolume: 1,
            filledAmount: 0,
            filledVolume: 0,
            averagePrice: null,
            expectedEdgeRate: null,
            estimatedCostRate: null,
            spreadRate: null,
            impactRate: null,
            gateBypassedReason: null,
            triggerReason: null,
          }),
          getOrderType: jest.fn().mockReturnValue(OrderTypes.BUY),
          calculateAmount: jest.fn(async (order: any) => (order?.status === 'closed' ? 100_000 : 0)),
          fetchOrder: jest.fn().mockResolvedValueOnce(closedOrder),
          calculateProfit: jest.fn().mockResolvedValue(0),
        },
      };
      const saveTradeSpy = jest.spyOn(service as any, 'saveTrade').mockResolvedValue({ id: 'trade-1' } as any);

      const trade = await service.executeTrade({
        runtime,
        user: { id: 'user-1' } as any,
        request: {
          symbol: 'BTC/KRW',
          diff: 1,
          balances: { info: [] } as any,
          requestedAmount: 100_000,
        } as any,
      });

      expect(runtime.exchangeService.fetchOrder).toHaveBeenCalledWith({ id: 'user-1' }, 'order-1', 'BTC/KRW');
      expect(saveTradeSpy).toHaveBeenCalledTimes(1);
      expect(trade).toEqual({ id: 'trade-1' });
    });
  });

  describe('included trade request sizing', () => {
    it('should cap per-symbol trade notional using the shared turnover fraction', () => {
      const runtime: any = {
        logger: { log: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {},
      };

      const requests = service.buildIncludedTradeRequests({
        runtime,
        balances: { info: [] } as any,
        candidates: [
          {
            id: 'rec-1',
            batchId: 'batch-1',
            symbol: 'BTC/KRW',
            category: Category.COIN_MAJOR,
            intensity: 1,
            modelTargetWeight: 1,
            action: 'buy',
            hasStock: false,
            decisionConfidence: 1,
            expectedEdgeRate: 1,
            estimatedCostRate: 0,
          } as any,
        ],
        targetSlotCount: 1,
        regimeMultiplier: 1,
        currentWeights: new Map<string, number>(),
        marketPrice: 1_000_000,
        calculateTargetWeight: () => 1,
      });

      expect(requests).toHaveLength(1);
      expect(requests[0].requestedTradeNotional).toBeCloseTo(1_000_000, 6);
      expect(requests[0].cappedTradeNotional).toBeCloseTo(100_000, 6);
      expect(requests[0].cappedTradeDiff).toBeCloseTo(0.1, 6);
    });

    it('should exclude buy requests with non-positive expected net edge', () => {
      const runtime: any = {
        logger: { log: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {},
      };

      const requests = service.buildIncludedTradeRequests({
        runtime,
        balances: { info: [] } as any,
        candidates: [
          {
            id: 'rec-1',
            batchId: 'batch-1',
            symbol: 'BTC/KRW',
            category: Category.COIN_MAJOR,
            intensity: 1,
            modelTargetWeight: 1,
            action: 'buy',
            hasStock: false,
            decisionConfidence: 1,
            expectedEdgeRate: 0.002,
            estimatedCostRate: 0.002,
          } as any,
        ],
        targetSlotCount: 1,
        regimeMultiplier: 1,
        currentWeights: new Map<string, number>(),
        marketPrice: 1_000_000,
        calculateTargetWeight: () => 1,
      });

      expect(requests).toHaveLength(0);
    });

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

    it('should derive buy action from persisted target even when persisted action is hold', () => {
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
      expect(scoped[0].modelTargetWeight).toBeCloseTo(0.3, 10);
    });

    it('should keep tiny position as hold when persisted target is zero', () => {
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

      expect(scoped[0].action).toBe('hold');
      expect(scoped[0].modelTargetWeight).toBeCloseTo(0.0001, 10);
    });

    it('should keep zero target when persisted inference action is sell', () => {
      const scoped = service.applyUserScopedRecommendationActions({
        inferences: [
          {
            id: 'rec-sell-zero',
            batchId: 'batch-1',
            symbol: 'BTC/KRW',
            category: Category.COIN_MAJOR,
            intensity: 0.02,
            buyScore: 0.20010280999999996,
            sellScore: 0.11389719000000002,
            modelTargetWeight: 0,
            action: 'sell',
            hasStock: true,
            decisionConfidence: 0.9,
          } as any,
        ],
        currentWeights: new Map<string, number>([['BTC/KRW', 0.2]]),
        targetSlotCount: 1,
      });

      expect(scoped[0].action).toBe('sell');
      expect(scoped[0].modelTargetWeight).toBe(0);
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

    it('should classify buy priority from refreshed tradable notional instead of stale hasStock', () => {
      const runtime: any = {
        logger: { log: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {},
      };
      const requests = service.buildIncludedTradeRequests({
        runtime,
        balances: { info: [] } as any,
        candidates: [
          {
            id: 'rec-1',
            batchId: 'batch-1',
            symbol: 'BTC/KRW',
            category: Category.COIN_MAJOR,
            intensity: 0.4,
            hasStock: false,
            decisionConfidence: 0.9,
            expectedEdgeRate: 0.08,
            estimatedCostRate: 0.01,
          } as any,
        ],
        targetSlotCount: 1,
        regimeMultiplier: 1,
        currentWeights: new Map<string, number>([['BTC/KRW', 0.1]]),
        marketPrice: 1_000_000,
        calculateTargetWeight: () => 0.2,
        tradableMarketValueMap: new Map<string, number>([['BTC/KRW', 10_000]]),
      });

      expect(requests).toHaveLength(1);
      expect(requests[0].positionClass).toBe('existing');
      expect(requests[0].expectedNetEdge).toBeCloseTo(0.0695, 10);
    });

    it('should keep incumbent buy priority when tradable map is missing but refreshed holding is meaningful', () => {
      const runtime: any = {
        logger: { log: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {},
      };
      const requests = service.buildIncludedTradeRequests({
        runtime,
        balances: { info: [] } as any,
        candidates: [
          {
            id: 'rec-1',
            batchId: 'batch-1',
            symbol: 'BTC/KRW',
            category: Category.COIN_MAJOR,
            intensity: 0.4,
            hasStock: false,
            decisionConfidence: 0.9,
            expectedEdgeRate: 0.08,
            estimatedCostRate: 0.01,
          } as any,
        ],
        targetSlotCount: 1,
        regimeMultiplier: 1,
        currentWeights: new Map<string, number>([['BTC/KRW', 0.1]]),
        marketPrice: 1_000_000,
        calculateTargetWeight: () => 0.2,
        tradableMarketValueMap: new Map<string, number>(),
      });

      expect(requests).toHaveLength(1);
      expect(requests[0].positionClass).toBe('existing');
    });

    it('should treat dust residual holdings as new for buy priority', () => {
      const runtime: any = {
        logger: { log: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {},
      };
      const requests = service.buildIncludedTradeRequests({
        runtime,
        balances: { info: [] } as any,
        candidates: [
          {
            id: 'rec-1',
            batchId: 'batch-1',
            symbol: 'BTC/KRW',
            category: Category.COIN_MAJOR,
            intensity: 0.4,
            hasStock: true,
            decisionConfidence: 0.9,
            expectedEdgeRate: 0.08,
            estimatedCostRate: 0.01,
          } as any,
        ],
        targetSlotCount: 1,
        regimeMultiplier: 1,
        currentWeights: new Map<string, number>([['BTC/KRW', 0.0001]]),
        marketPrice: 1_000_000,
        calculateTargetWeight: () => 0.2,
        tradableMarketValueMap: new Map<string, number>([['BTC/KRW', 4_000]]),
      });

      expect(requests).toHaveLength(1);
      expect(requests[0].positionClass).toBe('new');
    });
  });

  describe('regime unavailable buy policy', () => {
    it('should allow only incumbent re-risking within released notional budget', () => {
      const requests: any[] = [
        {
          symbol: 'BTC/KRW',
          inference: { category: Category.COIN_MAJOR },
          positionClass: 'existing',
          cappedTradeNotional: 300,
          estimatedNotional: 300,
          regimePolicyState: 'regimeUnavailable',
        },
        {
          symbol: 'ETH/KRW',
          inference: { category: Category.COIN_MAJOR },
          positionClass: 'new',
          cappedTradeNotional: 100,
          estimatedNotional: 100,
          regimePolicyState: 'regimeUnavailable',
        },
      ];
      const initialSnapshot: any = {
        balances: { KRW: { free: 200 }, info: [] },
        marketPrice: 1_000,
        currentWeights: new Map<string, number>([['BTC/KRW', 0.8]]),
      };
      const refreshedSnapshot: any = {
        balances: { KRW: { free: 600 }, info: [] },
        marketPrice: 1_000,
        currentWeights: new Map<string, number>([['BTC/KRW', 0.4]]),
      };
      const sellExecutions: any[] = [
        {
          request: {
            symbol: 'BTC/KRW',
            inference: { category: Category.COIN_MAJOR },
          },
          trade: {
            amount: 400,
          },
        },
      ];

      const filtered = (service as any).applyRegimeUnavailableBuyPolicy(
        requests,
        initialSnapshot,
        refreshedSnapshot,
        sellExecutions,
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].symbol).toBe('BTC/KRW');
    });
  });

  describe('latest recommendation metrics', () => {
    it('should build latest metrics map from latest recommendations with a single query', async () => {
      const subQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getQuery: jest
          .fn()
          .mockReturnValue(
            '(SELECT newer.id FROM allocation_recommendation newer WHERE newer.symbol = recommendation.symbol ORDER BY newer.created_at DESC, newer.id DESC LIMIT 1)',
          ),
      };
      const queryBuilder = {
        subQuery: jest.fn().mockReturnValue(subQueryBuilder),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            symbol: 'ETH/KRW',
            intensity: 0.6,
            modelTargetWeight: 0.7,
          } as AllocationRecommendation,
          {
            symbol: 'BTC/KRW',
            intensity: 0.2,
            modelTargetWeight: 0.3,
          } as AllocationRecommendation,
        ]),
      };
      const createQueryBuilderSpy = jest
        .spyOn(AllocationRecommendation, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

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

      expect(retryWithFallbackSpy).toHaveBeenCalledTimes(1);
      expect(createQueryBuilderSpy).toHaveBeenCalledWith('recommendation');
      expect(queryBuilder.subQuery).toHaveBeenCalledTimes(1);
      expect(subQueryBuilder.select).toHaveBeenCalledWith('newer.id');
      expect(subQueryBuilder.from).toHaveBeenCalledWith(AllocationRecommendation, 'newer');
      expect(subQueryBuilder.where).toHaveBeenCalledWith('newer.symbol = recommendation.symbol');
      expect(subQueryBuilder.orderBy).toHaveBeenCalledWith('newer.createdAt', 'DESC');
      expect(subQueryBuilder.addOrderBy).toHaveBeenCalledWith('newer.id', 'DESC');
      expect(subQueryBuilder.limit).toHaveBeenCalledWith(1);
      expect(queryBuilder.where).toHaveBeenCalledWith('recommendation.symbol IN (:...symbols)', {
        symbols: ['BTC/KRW', 'ETH/KRW'],
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('recommendation.id = (SELECT newer.id'),
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('recommendation.symbol', 'ASC');
      expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
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

    it('should map normalized DB symbols back to requested symbol keys', async () => {
      const subQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getQuery: jest
          .fn()
          .mockReturnValue(
            '(SELECT newer.id FROM allocation_recommendation newer WHERE newer.symbol = recommendation.symbol ORDER BY newer.created_at DESC, newer.id DESC LIMIT 1)',
          ),
      };
      const queryBuilder = {
        subQuery: jest.fn().mockReturnValue(subQueryBuilder),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            symbol: 'AAPL',
            intensity: 0.41,
            modelTargetWeight: 0.22,
          } as AllocationRecommendation,
        ]),
      };
      jest.spyOn(AllocationRecommendation, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      const result = await service.buildLatestRecommendationMetricsMap({
        recommendationItems: [{ symbol: ' aapl ', category: Category.NASDAQ, hasStock: true }],
        errorService: { retryWithFallback: async <T>(operation: () => Promise<T>) => operation() },
        onError: jest.fn(),
      });

      expect(queryBuilder.where).toHaveBeenCalledWith('recommendation.symbol IN (:...symbols)', {
        symbols: ['AAPL'],
      });
      expect(result.get(' aapl ')).toEqual({ intensity: 0.41, modelTargetWeight: 0.22 });
      expect(result.get('AAPL')).toEqual({ intensity: 0.41, modelTargetWeight: 0.22 });
    });
  });

  describe('realtime recommendation inference', () => {
    it('should parse a wrapped multi-symbol response in a single realtime request', async () => {
      const createResponse = jest.fn().mockResolvedValue({ id: 'chunk' });
      const getResponseOutput = jest.fn().mockReturnValue({
        text: JSON.stringify({
          recommendations: [
            {
              symbol: 'BTC/KRW',
              intensity: 0.2,
              confidence: 0.7,
              expectedVolatilityPct: 0.02,
              riskFlags: [],
              reason: 'BTC 근거',
            },
            {
              symbol: 'ETH/KRW',
              intensity: 0.1,
              confidence: 0.6,
              expectedVolatilityPct: 0.03,
              riskFlags: [],
              reason: 'ETH 근거',
            },
          ],
        }),
      });

      const results = await service.inferRecommendationsInRealtime({
        itemsByTargetSymbol: new Map([
          ['BTC/KRW', [{ symbol: 'BTC/KRW' }]],
          ['ETH/KRW', [{ symbol: 'ETH/KRW' }]],
        ]),
        prompt: 'system prompt',
        createRequestConfig: () => ({ model: 'gpt-5.4' }) as any,
        openaiService: {
          addMessage: jest.fn(),
          addPromptPair: jest.fn(),
          createResponse,
          getResponseOutput,
        },
        featureService: {
          MARKET_DATA_LEGEND: 'legend',
          extractMarketFeatures: jest.fn().mockResolvedValue(null),
          formatMarketData: jest.fn().mockReturnValue('market-data'),
        },
        newsService: {
          getCompactNews: jest.fn().mockResolvedValue([]),
        },
        marketRegimeService: {
          getSnapshot: jest.fn().mockResolvedValue(null),
        },
        errorService: {
          retryWithFallback: async <T>(operation: () => Promise<T>) => operation(),
        },
        allocationAuditService: {
          buildAllocationValidationGuardrailText: jest.fn().mockResolvedValue(null),
        },
        onNewsError: jest.fn(),
        onMarketRegimeError: jest.fn(),
        onValidationGuardrailError: jest.fn(),
        onUnexpectedSymbol: jest.fn(),
        onDuplicateSymbol: jest.fn(),
        onInferenceFailed: jest.fn(),
        buildIncompleteResponseError: ({ expectedCount, receivedCount }) =>
          `expected ${expectedCount}, received ${receivedCount}`,
        buildMissingResponseError: ({ symbol }) => `missing ${symbol}`,
        buildResult: ({ targetSymbol, normalizedResponse }) => ({
          symbol: targetSymbol,
          intensity: normalizedResponse?.intensity ?? 0,
        }),
      });

      expect(createResponse).toHaveBeenCalledTimes(1);
      expect(results).toEqual([
        { symbol: 'BTC/KRW', intensity: 0.2 },
        { symbol: 'ETH/KRW', intensity: 0.1 },
      ]);
    });

    it('should fail closed on malformed multi-symbol responses', async () => {
      const malformedErrorOutput = {
        text: JSON.stringify({
          recommendations: [
            {
              symbol: 'BTC/KRW',
              intensity: 0.2,
              confidence: 0.7,
              expectedVolatilityPct: 0.02,
              riskFlags: [],
              reason: 'BTC 근거',
            },
          ],
        }),
      };
      const onInferenceFailed = jest.fn();

      await expect(
        service.inferRecommendationsInRealtime({
          itemsByTargetSymbol: new Map([
            ['BTC/KRW', [{ symbol: 'BTC/KRW' }]],
            ['ETH/KRW', [{ symbol: 'ETH/KRW' }]],
          ]),
          prompt: 'system prompt',
          createRequestConfig: () => ({ model: 'gpt-5.4' }) as any,
          openaiService: {
            addMessage: jest.fn(),
            addPromptPair: jest.fn(),
            createResponse: jest.fn().mockResolvedValue({ id: 'chunk' }),
            getResponseOutput: jest.fn().mockReturnValue(malformedErrorOutput),
          },
          featureService: {
            MARKET_DATA_LEGEND: 'legend',
            extractMarketFeatures: jest.fn().mockResolvedValue(null),
            formatMarketData: jest.fn().mockReturnValue('market-data'),
          },
          newsService: {
            getCompactNews: jest.fn().mockResolvedValue([]),
          },
          marketRegimeService: {
            getSnapshot: jest.fn().mockResolvedValue(null),
          },
          errorService: {
            retryWithFallback: async <T>(operation: () => Promise<T>) => operation(),
          },
          allocationAuditService: {
            buildAllocationValidationGuardrailText: jest.fn().mockResolvedValue(null),
          },
          onNewsError: jest.fn(),
          onMarketRegimeError: jest.fn(),
          onValidationGuardrailError: jest.fn(),
          onUnexpectedSymbol: jest.fn(),
          onDuplicateSymbol: jest.fn(),
          onInferenceFailed,
          buildIncompleteResponseError: ({ expectedCount, receivedCount }) =>
            `expected ${expectedCount}, received ${receivedCount}`,
          buildMissingResponseError: ({ symbol }) => `missing ${symbol}`,
          buildResult: ({ targetSymbol, normalizedResponse }) => ({
            symbol: targetSymbol,
            intensity: normalizedResponse?.intensity ?? 0,
          }),
        }),
      ).rejects.toThrow('expected 2, received 1');

      expect(onInferenceFailed).toHaveBeenCalledTimes(1);
    });

    it('should fail closed on transport failures', async () => {
      const transportError = new Error('openai timeout');
      const createResponse = jest.fn().mockRejectedValue(transportError);
      const onInferenceFailed = jest.fn();

      await expect(
        service.inferRecommendationsInRealtime({
          itemsByTargetSymbol: new Map([
            ['BTC/KRW', [{ symbol: 'BTC/KRW' }]],
            ['ETH/KRW', [{ symbol: 'ETH/KRW' }]],
          ]),
          prompt: 'system prompt',
          createRequestConfig: () => ({ model: 'gpt-5.4' }) as any,
          openaiService: {
            addMessage: jest.fn(),
            addPromptPair: jest.fn(),
            createResponse,
            getResponseOutput: jest.fn(),
          },
          featureService: {
            MARKET_DATA_LEGEND: 'legend',
            extractMarketFeatures: jest.fn().mockResolvedValue(null),
            formatMarketData: jest.fn().mockReturnValue('market-data'),
          },
          newsService: {
            getCompactNews: jest.fn().mockResolvedValue([]),
          },
          marketRegimeService: {
            getSnapshot: jest.fn().mockResolvedValue(null),
          },
          errorService: {
            retryWithFallback: async <T>(operation: () => Promise<T>) => operation(),
          },
          allocationAuditService: {
            buildAllocationValidationGuardrailText: jest.fn().mockResolvedValue(null),
          },
          onNewsError: jest.fn(),
          onMarketRegimeError: jest.fn(),
          onValidationGuardrailError: jest.fn(),
          onUnexpectedSymbol: jest.fn(),
          onDuplicateSymbol: jest.fn(),
          onInferenceFailed,
          buildIncompleteResponseError: ({ expectedCount, receivedCount }) =>
            `expected ${expectedCount}, received ${receivedCount}`,
          buildMissingResponseError: ({ symbol }) => `missing ${symbol}`,
          buildResult: ({ targetSymbol, normalizedResponse }) => ({
            symbol: targetSymbol,
            intensity: normalizedResponse?.intensity ?? 0,
          }),
        }),
      ).rejects.toThrow('openai timeout');

      expect(createResponse).toHaveBeenCalledTimes(1);
      expect(onInferenceFailed).toHaveBeenCalledWith(transportError);
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
            trade: { type: OrderTypes.SELL, requestedVolume: 0.4, filledVolume: 0.4 },
          },
          {
            request: {
              symbol: 'XRP/KRW',
              diff: -1,
            },
            trade: { type: OrderTypes.SELL, requestedVolume: 200, filledVolume: 200 },
          },
          {
            request: {
              symbol: 'ETH/KRW',
              diff: -1,
              inference: { category: Category.COIN_MINOR },
            },
            trade: { type: OrderTypes.SELL, requestedVolume: 1, filledVolume: 0.4 },
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

    it('should treat near-equal volume as full liquidation to absorb execution drift', () => {
      const result = (service as any).collectLiquidatedHoldingItems(
        [
          {
            request: {
              symbol: 'BTC/KRW',
              diff: -1,
              inference: { category: Category.COIN_MAJOR },
            },
            trade: { type: OrderTypes.SELL, requestedVolume: 1, filledVolume: 0.996 },
          },
        ],
        OrderTypes.SELL,
        [{ symbol: 'BTC/KRW', category: Category.COIN_MAJOR }],
      );

      expect(result).toEqual([{ symbol: 'BTC/KRW', category: Category.COIN_MAJOR }]);
    });

    it('should keep holding ledger entry when remaining volume is still meaningful', () => {
      const result = (service as any).collectLiquidatedHoldingItems(
        [
          {
            request: {
              symbol: 'BTC/KRW',
              diff: -1,
              inference: { category: Category.COIN_MAJOR },
            },
            trade: { type: OrderTypes.SELL, requestedVolume: 1, filledVolume: 0.95 },
          },
        ],
        OrderTypes.SELL,
        [{ symbol: 'BTC/KRW', category: Category.COIN_MAJOR }],
      );

      expect(result).toEqual([]);
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
            trade: { type: OrderTypes.SELL, requestedVolume: 1, filledVolume: 0.6 },
          },
        ],
        OrderTypes.SELL,
        [{ symbol: 'BTC/KRW', category: Category.COIN_MAJOR }],
      );

      expect(result).toEqual([]);
    });

    it('should keep holding ledger entries when capped sell diff is not a full exit', () => {
      const result = (service as any).collectLiquidatedHoldingItems(
        [
          {
            request: {
              symbol: 'BTC/KRW',
              diff: -1,
              cappedTradeDiff: -0.1,
              inference: { category: Category.COIN_MAJOR },
            },
            trade: { type: OrderTypes.SELL, requestedVolume: 1, filledVolume: 1 },
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

    it('should apply unified buy notional budget without new-entry exemptions', async () => {
      const user = { id: 'user-1' } as any;
      const balances: any = {
        info: [{ currency: 'KRW', unit_currency: 'KRW', balance: '1000000' }],
      };
      const initialSnapshot = {
        balances,
        orderableSymbols: new Set<string>(),
        marketPrice: 1_000_000,
        currentWeights: new Map<string, number>([
          ['SELL-1/KRW', 0.1],
          ['SELL-2/KRW', 0.2],
        ]),
        tradableMarketValueMap: new Map<string, number>([
          ['SELL-1/KRW', 100_000],
          ['SELL-2/KRW', 200_000],
        ]),
      } as any;
      const refreshedSnapshot = {
        balances,
        orderableSymbols: new Set<string>([
          'NEW-ENTRY-A/KRW',
          'NEW-ENTRY-B/KRW',
          'REBALANCE-1/KRW',
          'REBALANCE-2/KRW',
          'REBALANCE-3/KRW',
        ]),
        marketPrice: 1_000_000,
        currentWeights: new Map<string, number>(),
        tradableMarketValueMap: new Map<string, number>(),
      } as any;
      const buyRequests = [
        {
          symbol: 'REBALANCE-1/KRW',
          diff: 0.1,
          balances,
          marketPrice: 1_000_000,
          positionClass: 'existing',
          deltaWeight: 0.1,
          expectedNetEdge: 0.05,
        },
        {
          symbol: 'REBALANCE-2/KRW',
          diff: 0.08,
          balances,
          marketPrice: 1_000_000,
          positionClass: 'existing',
          deltaWeight: 0.08,
          expectedNetEdge: 0.04,
        },
        {
          symbol: 'REBALANCE-3/KRW',
          diff: 0.02,
          balances,
          marketPrice: 1_000_000,
          positionClass: 'existing',
          deltaWeight: 0.02,
          expectedNetEdge: 0.01,
        },
        {
          symbol: 'NEW-ENTRY-A/KRW',
          diff: 0.07,
          balances,
          marketPrice: 1_000_000,
          positionClass: 'new',
          deltaWeight: 0.07,
          expectedNetEdge: 0.2,
        },
        {
          symbol: 'NEW-ENTRY-B/KRW',
          diff: 0.06,
          balances,
          marketPrice: 1_000_000,
          positionClass: 'new',
          deltaWeight: 0.06,
          expectedNetEdge: 0.15,
        },
      ] as any[];
      const holdingLedgerService: any = {
        fetchHoldingsByUser: jest.fn().mockResolvedValue([]),
        replaceHoldingsForUser: jest.fn().mockResolvedValue([]),
      };
      const notifyService: any = {
        notify: jest.fn(),
        clearClients: jest.fn(),
      };
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          getBalances: jest.fn().mockResolvedValue(balances),
          clearClients: jest.fn(),
        },
      };

      jest.spyOn(service, 'buildTradeExecutionSnapshot').mockResolvedValue(refreshedSnapshot);
      const executeTradeSpy = jest.spyOn(service, 'executeTrade').mockImplementation(
        async ({ request }: any) =>
          ({
            symbol: request.symbol,
            type: 'buy',
            amount: 10_000,
            profit: 0,
            inference: request.inference ?? null,
          }) as any,
      );

      const result = await service.executeRebalanceTrades({
        runtime,
        holdingLedgerService,
        notifyService,
        user,
        referenceSymbols: ['NEW-ENTRY-A/KRW', 'NEW-ENTRY-B/KRW', 'REBALANCE-1/KRW'],
        initialSnapshot,
        turnoverCap: 0.5,
        buildExcludedRequests: () => [],
        buildIncludedRequests: (snapshot) => (snapshot === initialSnapshot ? [] : buyRequests),
        buildNoTradeTrimRequests: () => [],
      });

      const executedSymbols = executeTradeSpy.mock.calls.map((call: any[]) => call[0].request.symbol);
      expect(executedSymbols).toEqual(['REBALANCE-1/KRW', 'REBALANCE-2/KRW']);
      expect(executeTradeSpy.mock.calls[1][0].request.diff).toBeCloseTo(0.065, 10);
      expect(executedSymbols).not.toContain('NEW-ENTRY-A/KRW');
      expect(executedSymbols).not.toContain('NEW-ENTRY-B/KRW');
      expect(result.map((trade) => trade.symbol)).toEqual(executedSymbols);
      expect(runtime.i18n.t).toHaveBeenCalledWith(
        'logging.inference.allocationRecommendation.buy_turnover_budget_applied',
        expect.objectContaining({
          args: expect.objectContaining({
            turnoverCap: 0.5,
            requestedCount: 5,
            requestedNotional: 330000,
            budgetNotional: 165000,
            selectedCount: 2,
            selectedNotional: 165000,
            selectedSymbols: 'REBALANCE-1/KRW,REBALANCE-2/KRW',
            skippedSymbols: 'REBALANCE-3/KRW,NEW-ENTRY-A/KRW,NEW-ENTRY-B/KRW',
            partialScaledSymbol: 'REBALANCE-2/KRW',
          }),
        }),
      );
    });

    it('should keep new-entry buys eligible when tradable value map is missing', async () => {
      const user = { id: 'user-1' } as any;
      const balances: any = {
        info: [{ currency: 'KRW', unit_currency: 'KRW', balance: '1000000' }],
      };
      const initialSnapshot = {
        balances,
        orderableSymbols: new Set<string>(),
        marketPrice: 1_000_000,
        currentWeights: new Map<string, number>([
          ['SELL-1/KRW', 0.1],
          ['SELL-2/KRW', 0.2],
        ]),
        tradableMarketValueMap: new Map<string, number>([
          ['SELL-1/KRW', 100_000],
          ['SELL-2/KRW', 200_000],
        ]),
      } as any;
      const refreshedSnapshot = {
        balances,
        orderableSymbols: new Set<string>(['NEW-ENTRY-A/KRW', 'REBALANCE-1/KRW']),
        marketPrice: 1_000_000,
        currentWeights: new Map<string, number>(),
        tradableMarketValueMap: new Map<string, number>(),
      } as any;
      const buyRequests = [
        {
          symbol: 'REBALANCE-1/KRW',
          diff: 0.05,
          balances,
          marketPrice: 1_000_000,
          positionClass: 'existing',
          deltaWeight: 0.05,
          expectedNetEdge: 0.04,
        },
        {
          symbol: 'NEW-ENTRY-A/KRW',
          diff: 0.07,
          balances,
          marketPrice: 1_000_000,
          positionClass: 'new',
          deltaWeight: 0.07,
          expectedNetEdge: 0.2,
        },
      ] as any[];
      const holdingLedgerService: any = {
        fetchHoldingsByUser: jest.fn().mockResolvedValue([]),
        replaceHoldingsForUser: jest.fn().mockResolvedValue([]),
      };
      const notifyService: any = {
        notify: jest.fn(),
        clearClients: jest.fn(),
      };
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          getBalances: jest.fn().mockResolvedValue(balances),
          clearClients: jest.fn(),
        },
      };

      jest.spyOn(service, 'buildTradeExecutionSnapshot').mockResolvedValue(refreshedSnapshot);
      const executeTradeSpy = jest.spyOn(service, 'executeTrade').mockImplementation(
        async ({ request }: any) =>
          ({
            symbol: request.symbol,
            type: 'buy',
            amount: 10_000,
            profit: 0,
            inference: request.inference ?? null,
          }) as any,
      );

      await service.executeRebalanceTrades({
        runtime,
        holdingLedgerService,
        notifyService,
        user,
        referenceSymbols: ['NEW-ENTRY-A/KRW', 'REBALANCE-1/KRW'],
        initialSnapshot,
        turnoverCap: 1,
        buildExcludedRequests: () => [],
        buildIncludedRequests: (snapshot) => (snapshot === initialSnapshot ? [] : buyRequests),
        buildNoTradeTrimRequests: () => [],
      });

      expect(executeTradeSpy.mock.calls.map((call: any[]) => call[0].request.symbol)).toEqual([
        'REBALANCE-1/KRW',
        'NEW-ENTRY-A/KRW',
      ]);
    });

    it('should apply sell notional budget with boundary partial scaling', async () => {
      const user = { id: 'user-1' } as any;
      const balances: any = {
        info: [{ currency: 'KRW', unit_currency: 'KRW', balance: '1000000' }],
      };
      const initialSnapshot = {
        balances,
        orderableSymbols: new Set<string>(),
        marketPrice: 1_000_000,
        currentWeights: new Map<string, number>([
          ['SELL-1/KRW', 0.1],
          ['SELL-2/KRW', 0.2],
        ]),
        tradableMarketValueMap: new Map<string, number>([
          ['SELL-1/KRW', 100_000],
          ['SELL-2/KRW', 200_000],
        ]),
      } as any;
      const sellRequests = [
        { symbol: 'SELL-1/KRW', diff: -0.1, balances, marketPrice: 1_000_000 },
        { symbol: 'SELL-2/KRW', diff: -0.2, balances, marketPrice: 1_000_000 },
      ] as any[];
      const holdingLedgerService: any = {
        fetchHoldingsByUser: jest.fn().mockResolvedValue([]),
        replaceHoldingsForUser: jest.fn().mockResolvedValue([]),
      };
      const notifyService: any = {
        notify: jest.fn(),
        clearClients: jest.fn(),
      };
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          getBalances: jest.fn().mockResolvedValue(balances),
          clearClients: jest.fn(),
        },
      };

      jest.spyOn(service, 'buildTradeExecutionSnapshot').mockResolvedValue(initialSnapshot);
      const executeTradeSpy = jest.spyOn(service, 'executeTrade').mockImplementation(
        async ({ request }: any) =>
          ({
            symbol: request.symbol,
            type: 'sell',
            amount: 10_000,
            profit: 0,
          }) as any,
      );

      await service.executeRebalanceTrades({
        runtime,
        holdingLedgerService,
        notifyService,
        user,
        referenceSymbols: ['SELL-1/KRW', 'SELL-2/KRW'],
        initialSnapshot,
        turnoverCap: 0.5,
        buildExcludedRequests: () => sellRequests,
        buildIncludedRequests: () => [],
        buildNoTradeTrimRequests: () => [],
      });

      expect(executeTradeSpy.mock.calls.map((call: any[]) => call[0].request.symbol)).toEqual([
        'SELL-1/KRW',
        'SELL-2/KRW',
      ]);
      expect(executeTradeSpy.mock.calls[1][0].request.diff).toBeCloseTo(-0.075, 10);
      expect(runtime.i18n.t).toHaveBeenCalledWith(
        'logging.inference.allocationRecommendation.sell_turnover_budget_applied',
        expect.objectContaining({
          args: expect.objectContaining({
            turnoverCap: 0.5,
            requestedCount: 2,
            requestedNotional: 50000,
            budgetNotional: 25000,
            selectedCount: 2,
            selectedNotional: 25000,
            selectedSymbols: 'SELL-1/KRW,SELL-2/KRW',
            skippedSymbols: '',
            partialScaledSymbol: 'SELL-2/KRW',
          }),
        }),
      );
    });

    it('should derive sell notional from refreshed current weight when tradable map is missing', async () => {
      const user = { id: 'user-1' } as any;
      const balances: any = {
        info: [{ currency: 'KRW', unit_currency: 'KRW', balance: '1000000' }],
      };
      const initialSnapshot = {
        balances,
        orderableSymbols: new Set<string>(),
        marketPrice: 1_000_000,
        currentWeights: new Map<string, number>([
          ['SELL-1/KRW', 0.01],
          ['SELL-2/KRW', 0.22],
        ]),
        tradableMarketValueMap: new Map<string, number>(),
      } as any;
      const sellRequests = [
        { symbol: 'SELL-1/KRW', diff: -1, balances, marketPrice: 1_000_000 },
        { symbol: 'SELL-2/KRW', diff: -0.1, balances, marketPrice: 1_000_000 },
      ] as any[];
      const holdingLedgerService: any = {
        fetchHoldingsByUser: jest.fn().mockResolvedValue([]),
        replaceHoldingsForUser: jest.fn().mockResolvedValue([]),
      };
      const notifyService: any = {
        notify: jest.fn(),
        clearClients: jest.fn(),
      };
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          getBalances: jest.fn().mockResolvedValue(balances),
          clearClients: jest.fn(),
        },
      };

      jest.spyOn(service, 'buildTradeExecutionSnapshot').mockResolvedValue(initialSnapshot);
      const executeTradeSpy = jest.spyOn(service, 'executeTrade').mockImplementation(
        async ({ request }: any) =>
          ({
            symbol: request.symbol,
            type: 'sell',
            amount: 10_000,
            profit: 0,
          }) as any,
      );

      await service.executeRebalanceTrades({
        runtime,
        holdingLedgerService,
        notifyService,
        user,
        referenceSymbols: ['SELL-1/KRW', 'SELL-2/KRW'],
        initialSnapshot,
        turnoverCap: 0.5,
        buildExcludedRequests: () => sellRequests,
        buildIncludedRequests: () => [],
        buildNoTradeTrimRequests: () => [],
      });

      expect(executeTradeSpy).toHaveBeenCalledTimes(2);
      expect(runtime.i18n.t).toHaveBeenCalledWith(
        'logging.inference.allocationRecommendation.sell_turnover_budget_applied',
        expect.objectContaining({
          args: expect.objectContaining({
            requestedCount: 2,
            requestedNotional: 32000,
            budgetNotional: 16000,
            selectedNotional: 16000,
            partialScaledSymbol: 'SELL-2/KRW',
          }),
        }),
      );
    });

    it('should not inflate sell notional to portfolio market value when symbol holding is unknown', async () => {
      const user = { id: 'user-1' } as any;
      const balances: any = {
        info: [{ currency: 'KRW', unit_currency: 'KRW', balance: '1000000' }],
      };
      const initialSnapshot = {
        balances,
        orderableSymbols: new Set<string>(),
        marketPrice: 1_000_000,
        currentWeights: new Map<string, number>(),
        tradableMarketValueMap: new Map<string, number>(),
      } as any;
      const sellRequests = [{ symbol: 'STALE-SELL/KRW', diff: -0.1, balances, marketPrice: 1_000_000 }] as any[];
      const holdingLedgerService: any = {
        fetchHoldingsByUser: jest.fn().mockResolvedValue([]),
        replaceHoldingsForUser: jest.fn().mockResolvedValue([]),
      };
      const notifyService: any = {
        notify: jest.fn(),
        clearClients: jest.fn(),
      };
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: {
          getBalances: jest.fn().mockResolvedValue(balances),
          clearClients: jest.fn(),
        },
      };

      jest.spyOn(service, 'buildTradeExecutionSnapshot').mockResolvedValue(initialSnapshot);
      const executeTradeSpy = jest.spyOn(service, 'executeTrade').mockResolvedValue(null as any);

      await service.executeRebalanceTrades({
        runtime,
        holdingLedgerService,
        notifyService,
        user,
        referenceSymbols: ['STALE-SELL/KRW'],
        initialSnapshot,
        turnoverCap: 0.5,
        buildExcludedRequests: () => sellRequests,
        buildIncludedRequests: () => [],
        buildNoTradeTrimRequests: () => [],
      });

      expect(executeTradeSpy).not.toHaveBeenCalled();
    });

    it('should bypass sell turnover budget for full-liquidation requests', async () => {
      const user = { id: 'user-1' } as any;
      const balances: any = { info: [{ currency: 'KRW', unit_currency: 'KRW', balance: '1000000' }] };
      const initialSnapshot = {
        balances,
        orderableSymbols: new Set<string>(),
        marketPrice: 1_000_000,
        currentWeights: new Map<string, number>([['ETH/KRW', 0.1]]),
        tradableMarketValueMap: new Map<string, number>([['ETH/KRW', 100_000]]),
      } as any;
      const holdingLedgerService: any = {
        fetchHoldingsByUser: jest.fn().mockResolvedValue([{ symbol: 'ETH/KRW', category: Category.COIN_MINOR }]),
        replaceHoldingsForUser: jest.fn().mockResolvedValue([]),
      };
      const notifyService: any = { notify: jest.fn(), clearClients: jest.fn() };
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: { getBalances: jest.fn().mockResolvedValue(balances), clearClients: jest.fn() },
      };

      jest.spyOn(service, 'buildTradeExecutionSnapshot').mockResolvedValue(initialSnapshot);
      const executeTradeSpy = jest.spyOn(service, 'executeTrade').mockImplementation(
        async ({ request }: any) =>
          ({
            symbol: request.symbol,
            type: 'sell',
            amount: 10_000,
            profit: 0,
            requestedVolume: 1,
            filledVolume: 1,
            inference: request.inference ?? null,
          }) as any,
      );

      await service.executeRebalanceTrades({
        runtime,
        holdingLedgerService,
        notifyService,
        user,
        referenceSymbols: ['ETH/KRW'],
        initialSnapshot,
        turnoverCap: 0.1,
        buildExcludedRequests: () => [],
        buildIncludedRequests: () => [
          {
            symbol: 'ETH/KRW',
            diff: -1,
            forcedFullLiquidation: true,
            balances,
            marketPrice: 1_000_000,
            inference: { symbol: 'ETH/KRW', category: Category.COIN_MINOR } as any,
          },
        ],
        buildNoTradeTrimRequests: () => [],
      });

      expect(executeTradeSpy).toHaveBeenCalledTimes(1);
      expect(executeTradeSpy.mock.calls[0][0].request.forcedFullLiquidation).toBe(true);
    });

    it('should keep diff=-1 staged exits inside sell turnover budget unless explicitly forced', async () => {
      const user = { id: 'user-1' } as any;
      const balances: any = { info: [{ currency: 'KRW', unit_currency: 'KRW', balance: '1000000' }] };
      const initialSnapshot = {
        balances,
        orderableSymbols: new Set<string>(),
        marketPrice: 1_000_000,
        currentWeights: new Map<string, number>([['ETH/KRW', 0.3]]),
        tradableMarketValueMap: new Map<string, number>([['ETH/KRW', 300_000]]),
      } as any;
      const holdingLedgerService: any = {
        fetchHoldingsByUser: jest.fn().mockResolvedValue([{ symbol: 'ETH/KRW', category: Category.COIN_MINOR }]),
        replaceHoldingsForUser: jest.fn().mockResolvedValue([]),
      };
      const notifyService: any = { notify: jest.fn(), clearClients: jest.fn() };
      const runtime: any = {
        logger: { log: jest.fn(), warn: jest.fn() },
        i18n: { t: jest.fn(translateKoMessage) },
        exchangeService: { getBalances: jest.fn().mockResolvedValue(balances), clearClients: jest.fn() },
      };

      jest.spyOn(service, 'buildTradeExecutionSnapshot').mockResolvedValue(initialSnapshot);
      const executeTradeSpy = jest.spyOn(service, 'executeTrade').mockResolvedValue(null);

      await service.executeRebalanceTrades({
        runtime,
        holdingLedgerService,
        notifyService,
        user,
        referenceSymbols: ['ETH/KRW'],
        initialSnapshot,
        turnoverCap: 0.1,
        buildExcludedRequests: () => [],
        buildIncludedRequests: () => [
          {
            symbol: 'ETH/KRW',
            diff: -1,
            cappedTradeDiff: -0.1,
            forcedFullLiquidation: false,
            balances,
            marketPrice: 1_000_000,
            estimatedNotional: 300_000,
            inference: { symbol: 'ETH/KRW', category: Category.COIN_MINOR } as any,
          },
        ],
        buildNoTradeTrimRequests: () => [],
      });

      expect(executeTradeSpy).toHaveBeenCalledTimes(1);
      expect(executeTradeSpy.mock.calls[0][0].request.cappedTradeDiff).toBeCloseTo(-0.01, 10);
    });
  });
});
