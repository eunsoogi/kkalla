import { Test, TestingModule } from '@nestjs/testing';

import { I18nService } from 'nestjs-i18n';

import { RecommendationItem } from '@/modules/allocation-core/allocation-core.types';
import { AllocationSlotService } from '@/modules/allocation-core/allocation-slot.service';
import {
  isNoTradeRecommendation,
  isSellAmountSufficient,
} from '@/modules/allocation-core/helpers/allocation-recommendation';
import { TradeOrchestrationService } from '@/modules/allocation-core/trade-orchestration.service';

import { AllocationAuditService } from '../allocation-audit/allocation-audit.service';
import { AllocationRecommendation } from '../allocation/entities/allocation-recommendation.entity';
import { CacheService } from '../cache/cache.service';
import { Category } from '../category/category.enum';
import { CategoryService } from '../category/category.service';
import { ErrorService } from '../error/error.service';
import { FeatureService } from '../feature/feature.service';
import { HoldingLedgerService } from '../holding-ledger/holding-ledger.service';
import { MarketRegimeService } from '../market-regime/market-regime.service';
import { NewsService } from '../news/news.service';
import { NotifyService } from '../notify/notify.service';
import { OpenaiService } from '../openai/openai.service';
import { ProfitService } from '../profit/profit.service';
import { RedlockService } from '../redlock/redlock.service';
import { ScheduleService } from '../schedule/schedule.service';
import { SlackService } from '../slack/slack.service';
import { TradeExecutionLedgerService } from '../trade-execution-ledger/trade-execution-ledger.service';
import { UPBIT_MINIMUM_TRADE_PRICE } from '../upbit/upbit.constant';
import { OrderTypes } from '../upbit/upbit.enum';
import { UpbitService } from '../upbit/upbit.service';
import { UserService } from '../user/user.service';
import { MarketRiskService } from './market-risk.service';

describe('MarketRiskService', () => {
  let service: MarketRiskService;
  let holdingLedgerService: jest.Mocked<HoldingLedgerService>;
  let upbitService: jest.Mocked<UpbitService>;
  const originalQueueUrl = process.env.AWS_SQS_QUEUE_URL_MARKET_RISK;

  beforeAll(() => {
    process.env.AWS_SQS_QUEUE_URL_MARKET_RISK = 'https://example.com/test-market-risk-queue';
  });

  afterAll(() => {
    if (originalQueueUrl == null) {
      delete process.env.AWS_SQS_QUEUE_URL_MARKET_RISK;
      return;
    }

    process.env.AWS_SQS_QUEUE_URL_MARKET_RISK = originalQueueUrl;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketRiskService,
        {
          provide: HoldingLedgerService,
          useValue: {
            fetchHoldingsByUsers: jest.fn(),
            fetchHoldingsByUser: jest.fn().mockResolvedValue([]),
            replaceHoldingsForUser: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: UpbitService,
          useValue: {
            getRecentMinuteCandles: jest.fn(),
            getBalances: jest.fn().mockResolvedValue({ info: [] }),
            calculateTradableMarketValue: jest.fn().mockResolvedValue(0),
            getPrice: jest.fn().mockResolvedValue(0),
            isSymbolExist: jest.fn().mockResolvedValue(true),
            clearClients: jest.fn(),
          },
        },
        {
          provide: RedlockService,
          useValue: {
            withLock: jest.fn(
              async (
                _resourceName: string,
                _duration: number,
                callback: (context: { signal: AbortSignal; assertLockOrThrow: () => void }) => Promise<unknown>,
              ) =>
                callback({
                  signal: new AbortController().signal,
                  assertLockOrThrow: jest.fn(),
                }),
            ),
          },
        },
        {
          provide: SlackService,
          useValue: {
            sendServer: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CategoryService,
          useValue: {
            checkCategoryPermission: jest.fn().mockReturnValue(true),
            findEnabledByUser: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: AllocationSlotService,
          useValue: {
            resolveAuthorizedSlotCount: jest.fn().mockResolvedValue(5),
          },
        },
        TradeOrchestrationService,
        {
          provide: NotifyService,
          useValue: {
            notify: jest.fn().mockResolvedValue(undefined),
            clearClients: jest.fn(),
          },
        },
        {
          provide: ProfitService,
          useValue: {
            getProfit: jest.fn().mockResolvedValue({ profit: 0 }),
          },
        },
        {
          provide: I18nService,
          useValue: {
            t: jest.fn((key: string) => key),
          },
        },
        {
          provide: ScheduleService,
          useValue: {
            getUsers: jest.fn().mockResolvedValue([{ id: 'user-1', roles: [] }]),
          },
        },
        {
          provide: NewsService,
          useValue: {
            getCompactNews: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: MarketRegimeService,
          useValue: {
            getSnapshot: jest.fn().mockResolvedValue({
              btcDominance: 55,
              altcoinIndex: 50,
              asOf: new Date(),
              source: 'live',
              isStale: false,
              staleAgeMinutes: 0,
            }),
          },
        },
        {
          provide: OpenaiService,
          useValue: {
            createResponse: jest.fn(),
            getResponseOutput: jest.fn(),
            getResponseOutputText: jest.fn(),
            addMessage: jest.fn(),
            addMessagePair: jest.fn(),
          },
        },
        {
          provide: FeatureService,
          useValue: {
            MARKET_DATA_LEGEND: 'legend',
            extractMarketFeatures: jest.fn(),
            formatMarketData: jest.fn(),
          },
        },
        {
          provide: ErrorService,
          useValue: {
            retryWithFallback: jest.fn((fn: () => Promise<unknown>) => fn()),
          },
        },
        {
          provide: AllocationAuditService,
          useValue: {
            enqueueAllocationBatchValidation: jest.fn().mockResolvedValue(undefined),
            buildAllocationValidationGuardrailText: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: UserService,
          useValue: {
            findById: jest.fn().mockResolvedValue({ id: 'user-1', roles: [] }),
          },
        },
        {
          provide: TradeExecutionLedgerService,
          useValue: {
            hashPayload: jest.fn().mockReturnValue('payload-hash'),
            acquire: jest.fn().mockResolvedValue({ acquired: true, status: 'processing', attemptCount: 1 }),
            getProcessingStaleMs: jest.fn().mockReturnValue(5 * 60 * 1000),
            heartbeatProcessing: jest.fn().mockResolvedValue(undefined),
            markSucceeded: jest.fn().mockResolvedValue(undefined),
            markRetryableFailed: jest.fn().mockResolvedValue(undefined),
            markNonRetryableFailed: jest.fn().mockResolvedValue(undefined),
            markStaleSkipped: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<MarketRiskService>(MarketRiskService);
    holdingLedgerService = module.get(HoldingLedgerService) as jest.Mocked<HoldingLedgerService>;
    upbitService = module.get(UpbitService) as jest.Mocked<UpbitService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should not trigger inference when there is no holdings', async () => {
    holdingLedgerService.fetchHoldingsByUsers.mockResolvedValueOnce([]);

    await service.handleTick();

    expect(holdingLedgerService.fetchHoldingsByUsers).toHaveBeenCalledTimes(1);
    expect(upbitService.getRecentMinuteCandles).not.toHaveBeenCalled();
  });

  it('should continue per-symbol checks when BTC trigger is on cooldown', async () => {
    const items: RecommendationItem[] = [
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ];

    holdingLedgerService.fetchHoldingsByUsers.mockResolvedValue(items);

    jest.spyOn(service as any, 'calculateSymbolVolatility').mockResolvedValue({
      triggered: true,
      prevPercent: 0.01,
      currPercent: 0.02,
      prevBucket: 0.01,
      currBucket: 0.02,
      netDirection: 0.02,
    });
    const cooldownSpy = jest.spyOn(service as any, 'isSymbolOnCooldown').mockResolvedValue(true);
    const perSymbolSpy = jest.spyOn(service as any, 'triggerPerSymbolVolatility').mockResolvedValue(false);

    await (service as any).checkMarketRiskEvents();

    expect(cooldownSpy).toHaveBeenCalledWith('BTC/KRW');
    expect(perSymbolSpy).toHaveBeenCalledWith(items, [{ id: 'user-1', roles: [] }]);
  });

  it('should use 1m candles window (5 + 5) and trigger inference only when volatility bucket increases', async () => {
    const items: RecommendationItem[] = [
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ];

    // 1분봉 6개 중:
    // - 이전 5개 구간: close 모두 100 → 변동폭 0% → 버킷 0
    // - 다음 5개 구간: close 중 1개 캔들에서만 104 → 변동폭 4% → 버킷 0 (미트리거, 5% step 기준)
    // - 이후 5개 구간: close 중 1개 캔들에서만 105 → 변동폭 5% → 버킷 1 (트리거, 5% step 기준)
    // Note: BTC/KRW는 1% step을 사용하므로, 이 테스트는 BTC가 아닌 다른 심볼(ETH/KRW)을 사용하여 5% step 동작을 검증
    holdingLedgerService.fetchHoldingsByUsers.mockResolvedValue(items);

    // 첫 번째 호출: 변동폭 0% → 4% (diff 4%) → 트리거 안 됨 (5% step 기준)
    // BTC/KRW 체크 (변동성 없음, 트리거 안 됨)
    (upbitService.getRecentMinuteCandles as jest.Mock).mockResolvedValueOnce([
      // [timestamp, open, high, low, close, volume]
      [0, 0, 100, 100, 100, 0],
      [1, 0, 100, 100, 100, 0],
      [2, 0, 100, 100, 100, 0],
      [3, 0, 100, 100, 100, 0],
      [4, 0, 100, 100, 100, 0],
      [5, 0, 100, 100, 100, 0], // BTC는 변동성 없음 (트리거 안 됨)
    ]);
    // ETH/KRW 체크 (변동폭 4%, 5% step 기준으로 트리거 안 됨)
    (upbitService.getRecentMinuteCandles as jest.Mock).mockResolvedValueOnce([
      [0, 0, 100, 100, 100, 0],
      [1, 0, 100, 100, 100, 0],
      [2, 0, 100, 100, 100, 0],
      [3, 0, 100, 100, 100, 0],
      [4, 0, 100, 100, 100, 0],
      [5, 0, 104, 100, 104, 0], // 다음 5개 윈도우의 maxHigh 104 → 변동폭 4%
    ]);

    await service.handleTick();

    // 두 번째 호출: 변동폭 0% → 5% (diff 5%) → 해당 종목에 대해서만 추론
    // BTC/KRW 체크 (변동성 없음, 트리거 안 됨)
    (upbitService.getRecentMinuteCandles as jest.Mock).mockResolvedValueOnce([
      [0, 0, 100, 100, 100, 0],
      [1, 0, 100, 100, 100, 0],
      [2, 0, 100, 100, 100, 0],
      [3, 0, 100, 100, 100, 0],
      [4, 0, 100, 100, 100, 0],
      [5, 0, 100, 100, 100, 0], // BTC는 변동성 없음 (트리거 안 됨)
    ]);
    // ETH/KRW 체크 (변동폭 5%, 5% step 기준으로 트리거 됨)
    (upbitService.getRecentMinuteCandles as jest.Mock).mockResolvedValueOnce([
      [0, 0, 100, 100, 100, 0],
      [1, 0, 100, 100, 100, 0],
      [2, 0, 100, 100, 100, 0],
      [3, 0, 100, 100, 100, 0],
      [4, 0, 100, 100, 100, 0],
      [5, 0, 105, 100, 105, 0], // 다음 5개 윈도우의 maxHigh 105 → 변동폭 5%
    ]);

    await service.handleTick();

    // 변동성 트리거가 발생했는지 확인
    expect(upbitService.getRecentMinuteCandles).toHaveBeenCalled();
  });

  it('should calculate netDirection over the full window horizon, not a 1m delta', async () => {
    (upbitService.getRecentMinuteCandles as jest.Mock).mockResolvedValueOnce([
      // [timestamp, open, high, low, close, volume]
      [0, 0, 100, 100, 100, 0],
      [1, 0, 100, 100, 100, 0],
      [2, 0, 100, 100, 100, 0],
      [3, 0, 100, 100, 100, 0],
      [4, 0, 100, 100, 100, 0],
      [5, 0, 100, 100, 100, 0],
      [6, 0, 100, 100, 100, 0],
      [7, 0, 100, 100, 100, 0],
      [8, 0, 100, 100, 100, 0],
      [9, 0, 104, 100, 104, 0], // prevWindow maxHigh=104 -> 4%
      [10, 0, 105, 100, 105, 0], // nextWindow maxHigh=105 -> 5%
    ]);

    const result = await (service as any).calculateSymbolVolatility('ETH/KRW');

    expect(result).not.toBeNull();
    expect(result.triggered).toBe(true);
    expect(result.netDirection).toBeCloseTo(0.05, 6);
    expect(result.netDirection).toBeGreaterThan(0.01);
  });

  it('should generate explicit exclusions for included symbols beyond count', () => {
    const balances: any = { info: [] };
    const inferences = [
      {
        symbol: 'AAA/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: true,
      },
      {
        symbol: 'BBB/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.8,
        hasStock: true,
      },
      {
        symbol: 'CCC/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.7,
        hasStock: true,
      },
    ];

    const excludedRequests = (service as any).generateExcludedTradeRequests(balances, inferences, 2, 1_000_000);

    expect(excludedRequests).toHaveLength(1);
    expect(excludedRequests[0]).toMatchObject({
      symbol: 'CCC/KRW',
    });
    expect(excludedRequests[0].diff).toBeLessThan(0);
    expect(excludedRequests[0].diff).toBeGreaterThanOrEqual(-1);
  });

  it('should exclude category-quota overflow symbols in risk mode', () => {
    const balances: any = { info: [] };
    const inferences = [
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.9,
        hasStock: true,
      },
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.8,
        hasStock: true,
      },
      {
        symbol: 'SOL/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.7,
        hasStock: true,
      },
    ];

    const excludedRequests = (service as any).generateExcludedTradeRequests(balances, inferences, 5, 1_000_000);

    expect(excludedRequests).toHaveLength(1);
    expect(excludedRequests[0]).toMatchObject({
      symbol: 'SOL/KRW',
    });
    expect(excludedRequests[0].diff).toBeLessThan(0);
    expect(excludedRequests[0].diff).toBeGreaterThanOrEqual(-1);
  });

  it('should calculate risk model signals in 0~1 range and apply regime multiplier', () => {
    const signals = (service as any).calculateModelSignals(0.65, Category.COIN_MINOR, null);

    expect(signals.buyScore).toBeGreaterThanOrEqual(0);
    expect(signals.buyScore).toBeLessThanOrEqual(1);
    expect(signals.sellScore).toBeGreaterThanOrEqual(0);
    expect(signals.sellScore).toBeLessThanOrEqual(1);
    expect(signals.modelTargetWeight).toBeGreaterThanOrEqual(0);
    expect(signals.modelTargetWeight).toBeLessThanOrEqual(1);

    const targetWeight = (service as any).calculateTargetWeight(
      {
        symbol: 'SUI/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.65,
        hasStock: true,
        modelTargetWeight: signals.modelTargetWeight,
      },
      0.95,
    );

    expect(targetWeight).toBeCloseTo(signals.modelTargetWeight * 0.95, 10);
  });

  it('should not apply category exposure scaling to model target weight', () => {
    const majorSignals = (service as any).calculateModelSignals(0.65, Category.COIN_MAJOR, null);
    const minorSignals = (service as any).calculateModelSignals(0.65, Category.COIN_MINOR, null);

    expect(majorSignals.buyScore).toBeCloseTo(minorSignals.buyScore, 10);
    expect(majorSignals.modelTargetWeight).toBeCloseTo(minorSignals.modelTargetWeight, 10);
  });

  it('should create positive included trade diff with conviction-normalized sizing', () => {
    const balances: any = { info: [] };
    const inferences = [
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: true,
        modelTargetWeight: 0.5,
      },
    ];
    const currentWeights = new Map<string, number>();

    const requests = (service as any).generateIncludedTradeRequests(
      balances,
      inferences,
      5,
      1,
      currentWeights,
      1_000_000,
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].diff).toBeGreaterThan(0);
    expect(requests[0].diff).toBeLessThanOrEqual(1);
  });

  it('should enforce regime-based category exposure caps when creating included trade requests in risk mode', () => {
    const balances: any = { info: [] };
    const currentWeights = new Map<string, number>();
    const inferences = [
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.9,
        hasStock: true,
        modelTargetWeight: 0.8,
        confidence: 0.9,
      },
      {
        symbol: 'XRP/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: true,
        modelTargetWeight: 0.8,
        confidence: 0.9,
      },
      {
        symbol: 'ADA/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: true,
        modelTargetWeight: 0.8,
        confidence: 0.9,
      },
    ];

    const requests = (service as any).generateIncludedTradeRequests(
      balances,
      inferences,
      5,
      1,
      currentWeights,
      1_000_000,
      undefined,
      undefined,
      1,
      {
        coinMajor: 0.7,
        coinMinor: 0.2,
        nasdaq: 0.2,
      },
    );

    const minorTargetSum = requests
      .filter((item: any) => item.inference?.category === Category.COIN_MINOR)
      .reduce((sum: number, item: any) => sum + item.diff, 0);
    expect(minorTargetSum).toBeLessThanOrEqual(0.200001);
  });

  it('should not consume category cap when included request is skipped by cost gate in risk mode', () => {
    const balances: any = { info: [] };
    const currentWeights = new Map<string, number>();
    const inferences = [
      {
        symbol: 'SKIP/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: true,
        modelTargetWeight: 0.8,
        expectedEdgeRate: 0.0001,
        estimatedCostRate: 0.02,
      },
      {
        symbol: 'KEEP/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: true,
        modelTargetWeight: 0.8,
        expectedEdgeRate: 0.2,
        estimatedCostRate: 0.0005,
      },
    ];

    const requests = (service as any).generateIncludedTradeRequests(
      balances,
      inferences,
      5,
      1,
      currentWeights,
      1_000_000,
      undefined,
      undefined,
      1,
      {
        coinMajor: 0.7,
        coinMinor: 0.2,
        nasdaq: 0.2,
      },
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('KEEP/KRW');
    expect(requests[0].diff).toBeGreaterThan(0);
  });

  it('should apply category quota when creating included trade requests in risk mode', () => {
    const balances: any = { info: [] };
    const inferences = [
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.9,
        hasStock: true,
        modelTargetWeight: 0.8,
      },
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.8,
        hasStock: true,
        modelTargetWeight: 0.8,
      },
      {
        symbol: 'SOL/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.7,
        hasStock: true,
        modelTargetWeight: 0.8,
      },
      {
        symbol: 'XRP/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.6,
        hasStock: true,
        modelTargetWeight: 0.8,
      },
    ];
    const currentWeights = new Map<string, number>();

    const requests = (service as any).generateIncludedTradeRequests(
      balances,
      inferences,
      5,
      1,
      currentWeights,
      1_000_000,
    );

    expect(requests).toHaveLength(3);
    const requestSymbols = requests.map((request: { symbol: string }) => request.symbol);
    expect(requestSymbols).toEqual(expect.arrayContaining(['BTC/KRW', 'ETH/KRW', 'XRP/KRW']));
    expect(requestSymbols).not.toContain('SOL/KRW');
  });

  it('should not create a bullish feature bias when market features are missing', () => {
    const weakSignals = (service as any).calculateModelSignals(0.05, Category.COIN_MINOR, null);
    const neutralSignals = (service as any).calculateModelSignals(0, Category.COIN_MINOR, null);

    expect(weakSignals.buyScore).toBeLessThan(0.1);
    expect(weakSignals.modelTargetWeight).toBeLessThan(0.1);
    expect(neutralSignals.buyScore).toBe(0);
  });

  it('should keep weak positive intensity as buy and treat negative intensity as sell', () => {
    const weakBullishSignals = (service as any).calculateModelSignals(0.1, Category.COIN_MINOR, null);
    const bearishSignals = (service as any).calculateModelSignals(-0.1, Category.COIN_MINOR, null);

    expect(weakBullishSignals.sellScore).toBeLessThan(0.6);
    expect(weakBullishSignals.modelTargetWeight).toBeGreaterThan(0);
    expect(weakBullishSignals.action).toBe('buy');

    expect(bearishSignals.modelTargetWeight).toBe(0);
    expect(bearishSignals.action).toBe('sell');
  });

  it('should skip excluded liquidation when symbol is not orderable or below minimum trade amount', () => {
    const balances: any = { info: [] };
    const inferences = [
      {
        symbol: 'AAA/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: true,
      },
      {
        symbol: 'BBB/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.8,
        hasStock: true,
      },
      {
        symbol: 'CCC/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.7,
        hasStock: true,
      },
    ];

    const orderableSymbols = new Set<string>(['BBB/KRW', 'CCC/KRW']);
    const tradableMarketValueMap = new Map<string, number>([
      ['BBB/KRW', 2_000], // 최소 주문 금액 미달
      ['CCC/KRW', 10_000],
    ]);

    const excludedRequests = (service as any).generateExcludedTradeRequests(
      balances,
      inferences,
      2,
      1_000_000,
      orderableSymbols,
      tradableMarketValueMap,
    );

    expect(excludedRequests).toHaveLength(1);
    expect(excludedRequests[0]).toMatchObject({
      symbol: 'CCC/KRW',
    });
    expect(excludedRequests[0].diff).toBeLessThan(0);
    expect(excludedRequests[0].diff).toBeGreaterThanOrEqual(-1);
  });

  it('should allow sell when tradable market value is unknown', () => {
    const isSufficient = isSellAmountSufficient('AAA/KRW', -1, UPBIT_MINIMUM_TRADE_PRICE, new Map<string, number>());
    expect(isSufficient).toBe(true);
  });

  it('should remove holdings on full liquidation even when inference intensity is positive', async () => {
    const categoryService = (service as any).categoryService;
    const tradeOrchestrationService = (service as any).tradeOrchestrationService;
    const balances: any = { info: [] };
    const user: any = { id: 'user-1' };
    const inferences = [
      {
        id: 'inference-1',
        batchId: 'batch-1',
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.2,
        hasStock: true,
      },
    ];

    upbitService.getBalances.mockResolvedValue(balances);
    upbitService.calculateTradableMarketValue.mockResolvedValue(1_000_000);
    holdingLedgerService.fetchHoldingsByUser.mockResolvedValue([
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        hasStock: true,
      },
    ]);
    categoryService.findEnabledByUser.mockResolvedValue([{ category: Category.COIN_MINOR }]);
    categoryService.checkCategoryPermission.mockReturnValue(true);

    jest.spyOn(service as any, 'generateExcludedTradeRequests').mockReturnValue([]);
    jest.spyOn(service as any, 'generateIncludedTradeRequests').mockReturnValue([
      {
        symbol: 'ETH/KRW',
        diff: -1,
        balances,
        marketPrice: 1_000_000,
        inference: inferences[0],
      },
    ]);
    jest.spyOn(tradeOrchestrationService, 'executeTrade').mockResolvedValue({
      symbol: 'ETH/KRW',
      type: OrderTypes.SELL,
      amount: 10_000,
      profit: 0,
      inference: inferences[0],
    });

    await service.executeVolatilityTradesForUser(user, inferences, true);

    expect(holdingLedgerService.replaceHoldingsForUser).toHaveBeenCalledWith(user, []);
  });

  it('should not persist inferred buys when buy execution fails', async () => {
    const categoryService = (service as any).categoryService;
    const tradeOrchestrationService = (service as any).tradeOrchestrationService;
    const balances: any = { info: [] };
    const user: any = { id: 'user-1' };
    const inferences = [
      {
        id: 'inference-1',
        batchId: 'batch-1',
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.7,
        modelTargetWeight: 0.7,
        action: 'buy',
        hasStock: true,
      },
    ];

    upbitService.getBalances.mockResolvedValue(balances);
    upbitService.calculateTradableMarketValue.mockResolvedValue(1_000_000);
    holdingLedgerService.fetchHoldingsByUser.mockResolvedValue([
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        hasStock: true,
      },
    ]);
    categoryService.findEnabledByUser.mockResolvedValue([{ category: Category.COIN_MINOR }]);
    categoryService.checkCategoryPermission.mockReturnValue(true);

    jest.spyOn(service as any, 'generateExcludedTradeRequests').mockReturnValue([]);
    jest.spyOn(service as any, 'generateIncludedTradeRequests').mockReturnValue([
      {
        symbol: 'ETH/KRW',
        diff: 0.4,
        balances,
        marketPrice: 1_000_000,
        inference: inferences[0],
      },
    ]);
    jest.spyOn(tradeOrchestrationService, 'executeTrade').mockResolvedValue(null);

    await service.executeVolatilityTradesForUser(user, inferences as any, true);

    expect(holdingLedgerService.replaceHoldingsForUser).toHaveBeenCalledWith(
      user,
      expect.arrayContaining([expect.objectContaining({ symbol: 'ETH/KRW', category: Category.COIN_MINOR })]),
    );
  });

  it('should skip trade persistence when adjusted order has no executed fill in risk mode', async () => {
    const tradeOrchestrationService = (service as any).tradeOrchestrationService;
    upbitService.adjustOrder = jest.fn().mockResolvedValue({
      order: {
        side: OrderTypes.BUY,
        status: 'open',
      },
      filledAmount: 0,
      filledRatio: 0,
      requestedAmount: 100_000,
      executionMode: 'limit_post_only',
      orderType: 'limit',
      timeInForce: 'po',
      requestPrice: 100_000_000,
      averagePrice: null,
      orderStatus: 'open',
      expectedEdgeRate: 0.02,
      estimatedCostRate: 0.001,
      spreadRate: 0.0004,
      impactRate: 0.0004,
      gateBypassedReason: null,
      triggerReason: 'included_rebalance',
    } as any);
    upbitService.getOrderType = jest.fn().mockReturnValue(OrderTypes.BUY) as any;
    upbitService.calculateAmount = jest.fn().mockResolvedValue(100_000) as any;
    upbitService.calculateProfit = jest.fn().mockResolvedValue(0) as any;

    const saveTradeSpy = jest.spyOn(tradeOrchestrationService as any, 'saveTrade');
    const trade = await tradeOrchestrationService.executeTrade({
      runtime: {
        logger: (service as any).logger,
        i18n: (service as any).i18n,
        exchangeService: upbitService,
      },
      user: { id: 'user-1', roles: [] } as any,
      request: {
        symbol: 'BTC/KRW',
        diff: 0.1,
        balances: { info: [] } as any,
      } as any,
    });

    expect(trade).toBeNull();
    expect(saveTradeSpy).not.toHaveBeenCalled();
  });

  it('should cap sell and buy executions by regime turnover cap in risk mode', async () => {
    const categoryService = (service as any).categoryService;
    const marketRegimeService = (service as any).marketRegimeService;
    const tradeOrchestrationService = (service as any).tradeOrchestrationService;
    const user: any = { id: 'user-1', roles: [] };
    const balances: any = {
      info: [{ currency: 'KRW', unit_currency: 'KRW', balance: '1000000' }],
    };
    const inferences = [
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.7,
        modelTargetWeight: 0.7,
        action: 'buy',
        hasStock: true,
      },
    ];

    categoryService.findEnabledByUser.mockResolvedValue([{ category: Category.COIN_MAJOR }]);
    categoryService.checkCategoryPermission.mockReturnValue(true);
    holdingLedgerService.fetchHoldingsByUser.mockResolvedValue([
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ]);
    upbitService.getBalances.mockResolvedValueOnce(balances).mockResolvedValueOnce(balances);
    upbitService.calculateTradableMarketValue.mockResolvedValue(1_000_000);
    marketRegimeService.getSnapshot.mockResolvedValue({
      btcDominance: 70,
      altcoinIndex: 10,
      asOf: new Date(),
      source: 'live',
      isStale: false,
      staleAgeMinutes: 0,
    });

    const sellRequests = [
      { symbol: 'SELL-1/KRW', diff: -0.4, balances, marketPrice: 1_000_000 },
      { symbol: 'SELL-2/KRW', diff: -0.4, balances, marketPrice: 1_000_000 },
      { symbol: 'SELL-3/KRW', diff: -0.4, balances, marketPrice: 1_000_000 },
    ] as any[];
    const buyRequests = [
      { symbol: 'BUY-1/KRW', diff: 0.2, balances, marketPrice: 1_000_000 },
      { symbol: 'BUY-2/KRW', diff: 0.2, balances, marketPrice: 1_000_000 },
      { symbol: 'BUY-3/KRW', diff: 0.2, balances, marketPrice: 1_000_000 },
    ] as any[];

    jest.spyOn(service as any, 'generateExcludedTradeRequests').mockReturnValue(sellRequests);
    jest.spyOn(service as any, 'generateNoTradeTrimRequests').mockReturnValue([]);
    jest
      .spyOn(service as any, 'generateIncludedTradeRequests')
      .mockReturnValueOnce([])
      .mockReturnValueOnce(buyRequests);
    const executeTradeSpy = jest
      .spyOn(tradeOrchestrationService, 'executeTrade')
      .mockImplementation(async ({ request }) => {
        return {
          symbol: request.symbol,
          type: request.diff < 0 ? 'sell' : 'buy',
          amount: 10_000,
          profit: 0,
          inference: request.inference ?? null,
        } as any;
      });

    await service.executeVolatilityTradesForUser(user, inferences as any, true);

    expect(executeTradeSpy).toHaveBeenCalledTimes(2);
    expect(executeTradeSpy.mock.calls.map((call) => call[0].request.symbol)).toEqual(['SELL-1/KRW', 'BUY-1/KRW']);
  });

  it('should override hasStock flag using the requesting user holdings', async () => {
    const categoryService = (service as any).categoryService;
    const upbitService = (service as any).upbitService;
    const includedSpy = jest.spyOn(service as any, 'generateIncludedTradeRequests').mockReturnValue([]);
    jest.spyOn(service as any, 'generateExcludedTradeRequests').mockReturnValue([]);

    holdingLedgerService.fetchHoldingsByUser.mockResolvedValueOnce([
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ]);
    categoryService.findEnabledByUser.mockResolvedValue([{ category: Category.COIN_MAJOR }]);
    categoryService.checkCategoryPermission.mockReturnValue(true);
    upbitService.getBalances.mockResolvedValue({ info: [] });
    upbitService.calculateTradableMarketValue.mockResolvedValue(1_000_000);

    await service.executeVolatilityTradesForUser(
      { id: 'user-1', roles: [] } as any,
      [
        {
          symbol: 'BTC/KRW',
          category: Category.COIN_MAJOR,
          hasStock: true,
        },
        {
          symbol: 'ETH/KRW',
          category: Category.COIN_MAJOR,
          hasStock: false,
        },
      ] as any,
    );

    const passedInferences = includedSpy.mock.calls[0][1];
    expect(passedInferences).toEqual([expect.objectContaining({ symbol: 'ETH/KRW', hasStock: true })]);
  });

  it('should use category-based slot count even when held recommendations are fewer', async () => {
    const categoryService = (service as any).categoryService;
    const user = { id: 'user-1', roles: [] } as any;
    const balances: any = { info: [] };
    const inferences = [
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.8,
        modelTargetWeight: 0.8,
        action: 'buy',
        hasStock: true,
      },
    ];

    holdingLedgerService.fetchHoldingsByUser.mockResolvedValueOnce([
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ]);
    categoryService.findEnabledByUser.mockResolvedValue([
      { category: Category.COIN_MAJOR },
      { category: Category.COIN_MINOR },
    ]);
    categoryService.checkCategoryPermission.mockReturnValue(true);
    upbitService.getBalances.mockResolvedValueOnce(balances).mockResolvedValueOnce(balances);
    upbitService.calculateTradableMarketValue.mockResolvedValue(1_000_000);

    jest.spyOn(service as any, 'generateExcludedTradeRequests').mockReturnValue([]);
    const includedSpy = jest.spyOn(service as any, 'generateIncludedTradeRequests').mockReturnValue([]);

    const result = await service.executeVolatilityTradesForUser(user, inferences as any, true);

    expect(result).toEqual([]);
    expect(includedSpy).toHaveBeenCalledTimes(2);
    expect(includedSpy.mock.calls[0][2]).toBe(5);
    expect(includedSpy.mock.calls[1][2]).toBe(5);
  });

  it('should skip notify and balance fetch when authorized recommendations are not held', async () => {
    const categoryService = (service as any).categoryService;
    const notifyService = (service as any).notifyService;
    const inferences = [
      {
        id: 'inference-1',
        batchId: 'batch-1',
        symbol: 'XRP/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.4,
        modelTargetWeight: 0.4,
        action: 'buy',
        hasStock: false,
      },
    ];

    categoryService.findEnabledByUser.mockResolvedValue([{ category: Category.COIN_MINOR }]);
    categoryService.checkCategoryPermission.mockReturnValue(true);

    const result = await service.executeVolatilityTradesForUser({ id: 'user-1', roles: [] } as any, inferences as any);

    expect(result).toEqual([]);
    expect(notifyService.notify).not.toHaveBeenCalled();
    expect(upbitService.getBalances).not.toHaveBeenCalled();
    expect(holdingLedgerService.replaceHoldingsForUser).not.toHaveBeenCalled();
  });

  it('should block trade-request backfill in risk mode', () => {
    const requests = (service as any).generateIncludedTradeRequests(
      { info: [] } as any,
      [
        {
          symbol: 'ETH/KRW',
          category: Category.COIN_MAJOR,
          intensity: 0.8,
          modelTargetWeight: 0.8,
          action: 'buy',
          hasStock: true,
        },
        {
          symbol: 'XRP/KRW',
          category: Category.COIN_MINOR,
          intensity: 0.9,
          modelTargetWeight: 0.9,
          action: 'buy',
          hasStock: false,
        },
      ] as any,
      5,
      1,
      new Map(),
      1_000_000,
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('ETH/KRW');
  });

  it('should generate trim-only sell request for overweight hold/no_trade recommendation in risk mode', () => {
    const balances: any = { info: [] };
    const requests = (service as any).generateNoTradeTrimRequests(
      balances,
      [
        {
          symbol: 'BTC/KRW',
          category: Category.COIN_MAJOR,
          hasStock: true,
          action: 'hold',
          intensity: 0,
          modelTargetWeight: 0.28,
        },
      ] as any,
      5,
      1,
      new Map([['BTC/KRW', 0.28]]),
      1_000_000,
      undefined,
      new Map([['BTC/KRW', 280_000]]),
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('BTC/KRW');
    expect(requests[0].diff).toBeCloseTo(-0.8, 10);
    expect(requests[0].diff).toBeGreaterThan(-1);
  });

  it('should not generate trim-only sell request when hold/no_trade recommendation is not overweight in risk mode', () => {
    const balances: any = { info: [] };
    const requests = (service as any).generateNoTradeTrimRequests(
      balances,
      [
        {
          symbol: 'BTC/KRW',
          category: Category.COIN_MAJOR,
          hasStock: true,
          action: 'no_trade',
          intensity: 0,
          modelTargetWeight: 0.28,
        },
      ] as any,
      5,
      1,
      new Map([['BTC/KRW', 0.056]]),
      1_000_000,
      undefined,
      new Map([['BTC/KRW', 56_000]]),
    );

    expect(requests).toHaveLength(0);
  });

  it('should not consume category cap when no-trade trim request is skipped by minimum sell amount in risk mode', () => {
    const balances: any = { info: [] };
    const requests = (service as any).generateNoTradeTrimRequests(
      balances,
      [
        {
          symbol: 'SKIP/KRW',
          category: Category.COIN_MAJOR,
          hasStock: true,
          action: 'hold',
          intensity: 0,
          modelTargetWeight: 0.3,
        },
        {
          symbol: 'KEEP/KRW',
          category: Category.COIN_MAJOR,
          hasStock: true,
          action: 'hold',
          intensity: 0,
          modelTargetWeight: 0.3,
        },
      ] as any,
      5,
      1,
      new Map([
        ['SKIP/KRW', 0.5],
        ['KEEP/KRW', 0.5],
      ]),
      1_000_000,
      undefined,
      new Map([
        ['SKIP/KRW', 1_000],
        ['KEEP/KRW', 100_000],
      ]),
      1,
      {
        coinMajor: 0.06,
        coinMinor: 0.8,
        nasdaq: 0.4,
      },
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('KEEP/KRW');
    expect(requests[0].diff).toBeLessThan(0);
  });

  it('should drop inference when AI returns symbol mismatch', async () => {
    const openaiService = (service as any).openaiService;
    const featureService = (service as any).featureService;

    jest.spyOn(AllocationRecommendation, 'find').mockResolvedValue([]);
    featureService.extractMarketFeatures.mockResolvedValue(null);
    featureService.formatMarketData.mockReturnValue('market-data');
    openaiService.createResponse.mockResolvedValue({} as any);
    openaiService.getResponseOutput.mockReturnValue({
      text: JSON.stringify({
        symbol: 'BTC',
        intensity: 0.35,
      }),
      citations: [],
    });

    const saveSpy = jest.spyOn(service, 'saveAllocationRecommendation').mockImplementation(async (recommendation) => {
      return {
        id: 'saved-1',
        seq: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        reason: null,
        ...recommendation,
      } as any;
    });

    const result = await service.allocationRecommendation([
      {
        symbol: 'KRW-BTC',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ]);

    expect(saveSpy).not.toHaveBeenCalled();
    expect(result).toHaveLength(0);
  });

  it('should keep raw reason for persistence and return sanitized reason', async () => {
    const openaiService = (service as any).openaiService;
    const featureService = (service as any).featureService;

    jest.spyOn(AllocationRecommendation, 'find').mockResolvedValue([]);
    featureService.extractMarketFeatures.mockResolvedValue(null);
    featureService.formatMarketData.mockReturnValue('market-data');
    openaiService.createResponse.mockResolvedValue({} as any);
    openaiService.getResponseOutput.mockReturnValue({
      text: JSON.stringify({
        symbol: 'BTC/KRW',
        intensity: 0.41,
        reason: '변동성 근거 〖4:0†source〗',
      }),
      citations: [],
    });

    const saveSpy = jest.spyOn(service, 'saveAllocationRecommendation').mockImplementation(async (recommendation) => {
      return {
        id: 'saved-2',
        seq: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...recommendation,
      } as any;
    });

    const result = await service.allocationRecommendation([
      {
        symbol: 'KRW-BTC',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ]);

    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ reason: '변동성 근거 〖4:0†source〗' }));
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('변동성 근거');
  });

  it('should preserve hold action as non-trading in volatility recommendation mapping', async () => {
    const openaiService = (service as any).openaiService;
    const featureService = (service as any).featureService;

    jest.spyOn(AllocationRecommendation, 'find').mockResolvedValue([]);
    featureService.extractMarketFeatures.mockResolvedValue(null);
    featureService.formatMarketData.mockReturnValue('market-data');
    openaiService.createResponse.mockResolvedValue({} as any);
    openaiService.getResponseOutput.mockReturnValue({
      text: JSON.stringify({
        symbol: 'BTC/KRW',
        action: 'hold',
        intensity: -0.8,
        confidence: 0.95,
      }),
      citations: [],
    });

    const saveSpy = jest.spyOn(service, 'saveAllocationRecommendation').mockImplementation(async (recommendation) => {
      return {
        id: 'saved-hold-1',
        seq: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...recommendation,
      } as any;
    });

    const result = await service.allocationRecommendation([
      {
        symbol: 'KRW-BTC',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ]);

    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ action: 'hold' }));
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('hold');
    expect(isNoTradeRecommendation(result[0], 0.35)).toBe(true);
  });

  it('should skip profit notify when no trades are executed in SQS message handling', async () => {
    const profitService = (service as any).profitService;
    const notifyService = (service as any).notifyService;

    jest.spyOn(service, 'executeVolatilityTradesForUser').mockResolvedValue([]);
    const sqsSendMock = jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);

    await (service as any).handleMessage({
      MessageId: 'message-1',
      ReceiptHandle: 'receipt-1',
      Body: JSON.stringify({
        version: 2,
        module: 'risk',
        runId: 'run-1',
        messageKey: 'run-1:user-1',
        userId: 'user-1',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        inferences: [],
      }),
    });

    expect(profitService.getProfit).not.toHaveBeenCalled();
    expect(notifyService.notify).not.toHaveBeenCalled();
    expect(sqsSendMock).toHaveBeenCalledTimes(1);
    expect((sqsSendMock.mock.calls[0][0] as any).input).toMatchObject({
      QueueUrl: process.env.AWS_SQS_QUEUE_URL_MARKET_RISK,
      ReceiptHandle: 'receipt-1',
    });
    expect((service as any).tradeExecutionLedgerService.markSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptCount: 1,
      }),
    );
  });

  it('should normalize legacy module key to canonical ledger module when parsing alias message', async () => {
    const ledgerService = (service as any).tradeExecutionLedgerService;
    jest.spyOn(service, 'executeVolatilityTradesForUser').mockResolvedValue([]);
    jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);

    await (service as any).handleMessage({
      MessageId: 'message-legacy-module',
      ReceiptHandle: 'receipt-legacy-module',
      Body: JSON.stringify({
        version: 2,
        module: 'volatility',
        runId: 'run-legacy',
        messageKey: 'run-legacy:user-1',
        userId: 'user-1',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        inferences: [],
      }),
    });

    expect(ledgerService.acquire).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'risk',
        messageKey: 'run-legacy:user-1',
        userId: 'user-1',
      }),
    );
  });

  it('should publish canonical risk module label', async () => {
    const sqsSendMock = jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);

    await (service as any).publishVolatilityMessage(
      [{ id: 'user-1' } as any],
      [
        {
          id: 'rec-1',
          batchId: 'batch-1',
          symbol: 'BTC/KRW',
          category: Category.COIN_MAJOR,
          intensity: 0.5,
          hasStock: false,
        },
      ],
    );

    expect(sqsSendMock).toHaveBeenCalledTimes(1);
    const messageBody = JSON.parse((sqsSendMock.mock.calls[0][0] as any).input.MessageBody);
    expect(messageBody.module).toBe('risk');
  });

  it('should keep message in queue when ledger entry is still processing', async () => {
    const ledgerService = (service as any).tradeExecutionLedgerService;
    const sqsSendMock = jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);
    ledgerService.acquire.mockResolvedValueOnce({
      acquired: false,
      status: 'processing',
    });

    await (service as any).handleMessage({
      MessageId: 'message-processing',
      ReceiptHandle: 'receipt-processing',
      Body: JSON.stringify({
        version: 2,
        module: 'risk',
        runId: 'run-2',
        messageKey: 'run-2:user-1',
        userId: 'user-1',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        inferences: [],
      }),
    });

    expect(sqsSendMock).toHaveBeenCalledTimes(1);
    expect((sqsSendMock.mock.calls[0][0] as any).input).toMatchObject({
      QueueUrl: process.env.AWS_SQS_QUEUE_URL_MARKET_RISK,
      ReceiptHandle: 'receipt-processing',
      VisibilityTimeout: 300,
    });
    expect(ledgerService.markSucceeded).not.toHaveBeenCalled();
    expect(ledgerService.markRetryableFailed).not.toHaveBeenCalled();
  });

  it('should defer message when user trade lock is busy', async () => {
    const ledgerService = (service as any).tradeExecutionLedgerService;
    const redlockService = (service as any).redlockService;
    const sqsSendMock = jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);
    redlockService.withLock.mockResolvedValueOnce(undefined);

    await (service as any).handleMessage({
      MessageId: 'message-lock-busy',
      ReceiptHandle: 'receipt-lock-busy',
      Body: JSON.stringify({
        version: 2,
        module: 'risk',
        runId: 'run-lock-busy',
        messageKey: 'run-lock-busy:user-1',
        userId: 'user-1',
        generatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        inferences: [],
      }),
    });

    expect(sqsSendMock).toHaveBeenCalledTimes(1);
    expect((sqsSendMock.mock.calls[0][0] as any).input).toMatchObject({
      QueueUrl: process.env.AWS_SQS_QUEUE_URL_MARKET_RISK,
      ReceiptHandle: 'receipt-lock-busy',
      VisibilityTimeout: 300,
    });
    expect(ledgerService.markSucceeded).not.toHaveBeenCalled();
    expect(ledgerService.markRetryableFailed).not.toHaveBeenCalled();
  });

  it('should not mark failed ledger status when acquire throws before attempt is assigned', async () => {
    const ledgerService = (service as any).tradeExecutionLedgerService;
    const sqsSendMock = jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);
    ledgerService.acquire.mockRejectedValueOnce(new Error('acquire failed'));

    await expect(
      (service as any).handleMessage({
        MessageId: 'message-acquire-fail',
        ReceiptHandle: 'receipt-acquire-fail',
        Body: JSON.stringify({
          version: 2,
          module: 'risk',
          runId: 'run-acquire-fail',
          messageKey: 'run-acquire-fail:user-1',
          userId: 'user-1',
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          inferences: [],
        }),
      }),
    ).rejects.toThrow('acquire failed');

    expect(ledgerService.markRetryableFailed).not.toHaveBeenCalled();
    expect(ledgerService.markNonRetryableFailed).not.toHaveBeenCalled();
    expect(sqsSendMock).not.toHaveBeenCalled();
  });

  it('should not downgrade succeeded ledger status when delete message fails', async () => {
    const ledgerService = (service as any).tradeExecutionLedgerService;
    jest.spyOn(service, 'executeVolatilityTradesForUser').mockResolvedValue([]);
    jest.spyOn((service as any).sqs, 'send').mockRejectedValueOnce(new Error('delete failed'));

    await expect(
      (service as any).handleMessage({
        MessageId: 'message-delete-fail',
        ReceiptHandle: 'receipt-delete-fail',
        Body: JSON.stringify({
          version: 2,
          module: 'risk',
          runId: 'run-3',
          messageKey: 'run-3:user-1',
          userId: 'user-1',
          generatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          inferences: [],
        }),
      }),
    ).rejects.toThrow('delete failed');

    expect(ledgerService.markSucceeded).toHaveBeenCalledTimes(1);
    expect(ledgerService.markRetryableFailed).not.toHaveBeenCalled();
  });
});
