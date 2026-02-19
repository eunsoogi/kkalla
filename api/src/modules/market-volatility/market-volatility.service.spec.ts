import { Test, TestingModule } from '@nestjs/testing';

import { I18nService } from 'nestjs-i18n';

import { CacheService } from '../cache/cache.service';
import { Category } from '../category/category.enum';
import { CategoryService } from '../category/category.service';
import { ErrorService } from '../error/error.service';
import { FeargreedService } from '../feargreed/feargreed.service';
import { FeatureService } from '../feature/feature.service';
import { HistoryService } from '../history/history.service';
import { NewsService } from '../news/news.service';
import { NotifyService } from '../notify/notify.service';
import { OpenaiService } from '../openai/openai.service';
import { ProfitService } from '../profit/profit.service';
import { RecommendationItem } from '../rebalance/rebalance.interface';
import { RedlockService } from '../redlock/redlock.service';
import { ScheduleService } from '../schedule/schedule.service';
import { SlackService } from '../slack/slack.service';
import { OrderTypes } from '../upbit/upbit.enum';
import { UpbitService } from '../upbit/upbit.service';
import { MarketVolatilityService } from './market-volatility.service';

describe('MarketVolatilityService', () => {
  let service: MarketVolatilityService;
  let historyService: jest.Mocked<HistoryService>;
  let upbitService: jest.Mocked<UpbitService>;
  const originalQueueUrl = process.env.AWS_SQS_QUEUE_URL_VOLATILITY;

  beforeAll(() => {
    process.env.AWS_SQS_QUEUE_URL_VOLATILITY = 'https://example.com/test-volatility-queue';
  });

  afterAll(() => {
    if (originalQueueUrl == null) {
      delete process.env.AWS_SQS_QUEUE_URL_VOLATILITY;
      return;
    }

    process.env.AWS_SQS_QUEUE_URL_VOLATILITY = originalQueueUrl;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketVolatilityService,
        {
          provide: HistoryService,
          useValue: {
            fetchHistory: jest.fn(),
            removeHistory: jest.fn().mockResolvedValue(undefined),
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
            withLock: jest.fn(async (_resourceName: string, _duration: number, callback: () => Promise<any>) =>
              callback(),
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
            getUsers: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: NewsService,
          useValue: {
            getCompactNews: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: FeargreedService,
          useValue: {
            getCompactFeargreed: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: OpenaiService,
          useValue: {
            createResponse: jest.fn(),
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
      ],
    }).compile();

    service = module.get<MarketVolatilityService>(MarketVolatilityService);
    historyService = module.get(HistoryService) as jest.Mocked<HistoryService>;
    upbitService = module.get(UpbitService) as jest.Mocked<UpbitService>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should not trigger inference when there is no history', async () => {
    historyService.fetchHistory.mockResolvedValueOnce([]);

    await service.handleTick();

    expect(historyService.fetchHistory).toHaveBeenCalledTimes(1);
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

    historyService.fetchHistory.mockResolvedValue(items);

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

    await (service as any).checkMarketVolatility();

    expect(cooldownSpy).toHaveBeenCalledWith('BTC/KRW');
    expect(perSymbolSpy).toHaveBeenCalledWith(items);
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
    historyService.fetchHistory.mockResolvedValue(items);

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
      diff: -1,
    });
  });

  it('should calculate volatility model signals in 0~1 range and apply regime multiplier', () => {
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

  it('should apply top-k scaling when creating included trade requests', () => {
    const balances: any = { info: [] };
    const inferences = [
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: false,
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
    expect(requests[0].diff).toBeCloseTo(0.1, 10);
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
      diff: -1,
    });
  });

  it('should keep unchecked symbols when orderable validation partially fails', async () => {
    upbitService.isSymbolExist
      .mockResolvedValueOnce(true) // AAA/KRW
      .mockRejectedValueOnce(new Error('temporary failure')); // BBB/KRW

    const result = await (service as any).buildOrderableSymbolSet(['AAA/KRW', 'BBB/KRW']);

    expect(result).toBeInstanceOf(Set);
    expect(result.has('AAA/KRW')).toBe(true);
    expect(result.has('BBB/KRW')).toBe(true);
  });

  it('should allow sell when tradable market value is unknown', () => {
    const isSufficient = (service as any).isSellAmountSufficient('AAA/KRW', -1, new Map<string, number>());
    expect(isSufficient).toBe(true);
  });

  it('should remove history on full liquidation even when inference intensity is positive', async () => {
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

    jest.spyOn(service as any, 'filterUserAuthorizedBalanceRecommendations').mockResolvedValue(inferences);
    jest.spyOn(service as any, 'getItemCount').mockResolvedValue(1);
    jest.spyOn(service as any, 'getMarketRegimeMultiplier').mockResolvedValue(1);
    jest.spyOn(service as any, 'buildCurrentWeightMap').mockResolvedValue(new Map());
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
    jest.spyOn(service as any, 'executeTrade').mockResolvedValue({
      symbol: 'ETH/KRW',
      type: OrderTypes.SELL,
      amount: 10_000,
      profit: 0,
      inference: inferences[0],
    });

    await service.executeVolatilityTradesForUser(user, inferences, true);

    expect(historyService.removeHistory).toHaveBeenCalledWith([
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
      },
    ]);
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
        user: { id: 'user-1' },
        inferences: [],
        buyAvailable: true,
      }),
    });

    expect(profitService.getProfit).not.toHaveBeenCalled();
    expect(notifyService.notify).not.toHaveBeenCalled();
    expect(sqsSendMock).toHaveBeenCalledTimes(1);
    expect((sqsSendMock.mock.calls[0][0] as any).input).toMatchObject({
      QueueUrl: process.env.AWS_SQS_QUEUE_URL_VOLATILITY,
      ReceiptHandle: 'receipt-1',
    });
  });
});
