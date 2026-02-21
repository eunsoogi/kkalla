import { Category } from '../category/category.enum';
import { MarketRecommendation } from '../market-research/entities/market-recommendation.entity';
import { MARKET_RECOMMENDATION_STATE_MAX_AGE_MS } from '../market-research/market-research.interface';
import { OrderTypes } from '../upbit/upbit.enum';
import { BalanceRecommendation } from './entities/balance-recommendation.entity';
import { RebalanceService } from './rebalance.service';

describe('RebalanceService', () => {
  let service: RebalanceService;
  let cacheService: {
    get: jest.Mock;
  };

  const originalQueueUrl = process.env.AWS_SQS_QUEUE_URL_REBALANCE;

  beforeAll(() => {
    process.env.AWS_SQS_QUEUE_URL_REBALANCE = 'https://example.com/test-rebalance-queue';
  });

  afterAll(() => {
    if (originalQueueUrl == null) {
      delete process.env.AWS_SQS_QUEUE_URL_REBALANCE;
      return;
    }

    process.env.AWS_SQS_QUEUE_URL_REBALANCE = originalQueueUrl;
  });

  beforeEach(() => {
    cacheService = {
      get: jest.fn(),
    };

    service = new RebalanceService(
      {
        t: jest.fn((key: string) => key),
      } as any,
      {
        findAll: jest.fn().mockResolvedValue([]),
      } as any,
      {
        fetchHistoryByUsers: jest.fn().mockResolvedValue([]),
        fetchHistoryByUser: jest.fn().mockResolvedValue([]),
        saveHistoryForUser: jest.fn().mockResolvedValue(undefined),
      } as any,
      {
        getPrice: jest.fn(),
        getBalances: jest.fn(),
        isSymbolExist: jest.fn().mockResolvedValue(true),
        clearClients: jest.fn(),
      } as any,
      cacheService as any,
      {
        getUsers: jest.fn().mockResolvedValue([]),
      } as any,
      {
        findEnabledByUser: jest.fn().mockResolvedValue([]),
        checkCategoryPermission: jest.fn().mockReturnValue(true),
      } as any,
      {
        notify: jest.fn().mockResolvedValue(undefined),
        clearClients: jest.fn(),
      } as any,
      {
        getProfit: jest.fn().mockResolvedValue({ profit: 0 }),
      } as any,
      {
        getCompactNews: jest.fn().mockResolvedValue([]),
      } as any,
      {
        getCompactFeargreed: jest.fn().mockResolvedValue(null),
      } as any,
      {
        createResponse: jest.fn(),
        getResponseOutput: jest.fn(),
        getResponseOutputText: jest.fn(),
        addMessage: jest.fn(),
        addMessagePair: jest.fn(),
      } as any,
      {
        MARKET_DATA_LEGEND: 'legend',
        extractMarketFeatures: jest.fn(),
        formatMarketData: jest.fn(),
      } as any,
      {
        retryWithFallback: jest.fn((fn: () => Promise<unknown>) => fn()),
      } as any,
      {
        enqueuePortfolioBatchValidation: jest.fn().mockResolvedValue(undefined),
        buildPortfolioValidationGuardrailText: jest.fn().mockResolvedValue(null),
        getPortfolioValidationBadgeMap: jest.fn().mockResolvedValue(new Map()),
        getRecommendedMarketMinConfidenceForPortfolio: jest.fn().mockResolvedValue(0.55),
      } as any,
      {
        findById: jest.fn().mockResolvedValue({ id: 'user-1', roles: [] }),
      } as any,
      {
        withLock: jest.fn(async (_resourceName: string, _duration: number, callback: () => Promise<unknown>) =>
          callback(),
        ),
      } as any,
      {
        hashPayload: jest.fn().mockReturnValue('payload-hash'),
        acquire: jest.fn().mockResolvedValue({ acquired: true, status: 'processing', attemptCount: 1 }),
        getProcessingStaleMs: jest.fn().mockReturnValue(5 * 60 * 1000),
        heartbeatProcessing: jest.fn().mockResolvedValue(undefined),
        markSucceeded: jest.fn().mockResolvedValue(undefined),
        markRetryableFailed: jest.fn().mockResolvedValue(undefined),
        markNonRetryableFailed: jest.fn().mockResolvedValue(undefined),
        markStaleSkipped: jest.fn().mockResolvedValue(undefined),
      } as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fallback to latest recommendations when recommendation cache state is stale', async () => {
    cacheService.get.mockResolvedValue({
      batchId: 'stale-batch',
      hasRecommendations: true,
      updatedAt: Date.now() - MARKET_RECOMMENDATION_STATE_MAX_AGE_MS - 1,
    });

    const latestRecommendations = [
      {
        symbol: 'ETH/KRW',
        batchId: 'latest-batch',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(),
      },
      {
        symbol: 'SOL/KRW',
        batchId: 'latest-batch',
        weight: 0.25,
        confidence: 0.9,
        createdAt: new Date(),
      },
      {
        symbol: 'DOGE/KRW',
        batchId: 'latest-batch',
        weight: 0.03,
        confidence: 0.9,
        createdAt: new Date(),
      },
    ] as MarketRecommendation[];

    const latestSpy = jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue(latestRecommendations);

    const items = await (service as any).fetchRecommendItems();

    expect(latestSpy).toHaveBeenCalledTimes(1);
    expect(items).toEqual([
      {
        symbol: 'SOL/KRW',
        category: Category.COIN_MINOR,
        hasStock: false,
        weight: 0.25,
        confidence: 0.9,
      },
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        hasStock: false,
        weight: 0.2,
        confidence: 0.8,
      },
    ]);
  });

  it('should return empty recommendations when latest state says no recommendations and no newer batch exists', async () => {
    const updatedAt = Date.now();
    cacheService.get.mockResolvedValue({
      batchId: 'batch-empty',
      hasRecommendations: false,
      updatedAt,
    });

    const latestSpy = jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue([
      {
        symbol: 'ETH/KRW',
        batchId: 'batch-empty',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(updatedAt - 60_000),
      },
    ] as MarketRecommendation[]);

    const findSpy = jest.spyOn(MarketRecommendation, 'find');

    const items = await (service as any).fetchRecommendItems();

    expect(latestSpy).toHaveBeenCalledTimes(1);
    expect(findSpy).not.toHaveBeenCalled();
    expect(items).toEqual([]);
  });

  it('should fallback to latest batch when cached batch differs from latest recommendations', async () => {
    const updatedAt = Date.now();
    cacheService.get.mockResolvedValue({
      batchId: 'batch-a',
      hasRecommendations: true,
      updatedAt,
    });

    const findSpy = jest.spyOn(MarketRecommendation, 'find').mockResolvedValue([
      {
        symbol: 'OLD/KRW',
        batchId: 'batch-a',
        weight: 0.3,
        confidence: 0.9,
        createdAt: new Date(updatedAt - 10_000),
      },
    ] as MarketRecommendation[]);

    const latestSpy = jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue([
      {
        symbol: 'NEW/KRW',
        batchId: 'batch-b',
        weight: 0.15,
        confidence: 0.7,
        createdAt: new Date(updatedAt - 5_000),
      },
    ] as MarketRecommendation[]);

    const items = await (service as any).fetchRecommendItems();

    expect(findSpy).toHaveBeenCalledWith({ where: { batchId: 'batch-a' } });
    expect(latestSpy).toHaveBeenCalledTimes(1);
    expect(items).toEqual([
      {
        symbol: 'NEW/KRW',
        category: Category.COIN_MINOR,
        hasStock: false,
        weight: 0.15,
        confidence: 0.7,
      },
    ]);
  });

  it('should schedule new rebalance per user with user-scoped history', async () => {
    const scheduleService = (service as any).scheduleService;
    const historyService = (service as any).historyService;
    const users = [
      { id: 'user-1', roles: [] },
      { id: 'user-2', roles: [] },
    ];

    scheduleService.getUsers.mockResolvedValue(users);
    historyService.fetchHistoryByUser
      .mockResolvedValueOnce([
        {
          symbol: 'USER1_ONLY/KRW',
          category: Category.COIN_MINOR,
          hasStock: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          symbol: 'USER2_ONLY/KRW',
          category: Category.COIN_MINOR,
          hasStock: true,
        },
      ]);

    jest.spyOn(service as any, 'fetchMajorCoinItems').mockResolvedValue([
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
        hasStock: false,
      },
    ]);
    jest.spyOn(service as any, 'fetchRecommendItems').mockResolvedValue([
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        hasStock: false,
      },
    ]);
    jest
      .spyOn(service as any, 'filterBalanceRecommendations')
      .mockImplementation(async (items: Array<{ symbol: string; category: Category; hasStock: boolean }>) => items);
    const scheduleSpy = jest.spyOn(service as any, 'scheduleRebalance').mockResolvedValue(undefined);

    await service.executeBalanceRecommendationNewTask();

    expect(historyService.fetchHistoryByUser).toHaveBeenCalledTimes(2);
    expect(historyService.fetchHistoryByUser).toHaveBeenNthCalledWith(1, users[0]);
    expect(historyService.fetchHistoryByUser).toHaveBeenNthCalledWith(2, users[1]);

    expect(scheduleSpy).toHaveBeenCalledTimes(2);
    expect(scheduleSpy).toHaveBeenNthCalledWith(
      1,
      [users[0]],
      expect.arrayContaining([expect.objectContaining({ symbol: 'USER1_ONLY/KRW' })]),
      'new',
    );
    expect(scheduleSpy).toHaveBeenNthCalledWith(
      2,
      [users[1]],
      expect.arrayContaining([expect.objectContaining({ symbol: 'USER2_ONLY/KRW' })]),
      'new',
    );
    const firstSymbols = scheduleSpy.mock.calls[0][1].map((item: { symbol: string }) => item.symbol);
    const secondSymbols = scheduleSpy.mock.calls[1][1].map((item: { symbol: string }) => item.symbol);
    expect(firstSymbols).not.toContain('USER2_ONLY/KRW');
    expect(secondSymbols).not.toContain('USER1_ONLY/KRW');
  });

  it('should schedule existing rebalance per user with user-scoped history', async () => {
    const scheduleService = (service as any).scheduleService;
    const historyService = (service as any).historyService;
    const users = [
      { id: 'user-1', roles: [] },
      { id: 'user-2', roles: [] },
    ];

    scheduleService.getUsers.mockResolvedValue(users);
    historyService.fetchHistoryByUser
      .mockResolvedValueOnce([
        {
          symbol: 'USER1_ONLY/KRW',
          category: Category.COIN_MINOR,
          hasStock: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          symbol: 'USER2_ONLY/KRW',
          category: Category.COIN_MINOR,
          hasStock: true,
        },
      ]);

    jest
      .spyOn(service as any, 'filterBalanceRecommendations')
      .mockImplementation(async (items: Array<{ symbol: string; category: Category; hasStock: boolean }>) => items);
    const scheduleSpy = jest.spyOn(service as any, 'scheduleRebalance').mockResolvedValue(undefined);

    await service.executeBalanceRecommendationExistingTask();

    expect(historyService.fetchHistoryByUsers).not.toHaveBeenCalled();
    expect(historyService.fetchHistoryByUser).toHaveBeenCalledTimes(2);
    expect(historyService.fetchHistoryByUser).toHaveBeenNthCalledWith(1, users[0]);
    expect(historyService.fetchHistoryByUser).toHaveBeenNthCalledWith(2, users[1]);

    expect(scheduleSpy).toHaveBeenCalledTimes(2);
    expect(scheduleSpy).toHaveBeenNthCalledWith(
      1,
      [users[0]],
      expect.arrayContaining([expect.objectContaining({ symbol: 'USER1_ONLY/KRW' })]),
      'existing',
    );
    expect(scheduleSpy).toHaveBeenNthCalledWith(
      2,
      [users[1]],
      expect.arrayContaining([expect.objectContaining({ symbol: 'USER2_ONLY/KRW' })]),
      'existing',
    );
    const firstSymbols = scheduleSpy.mock.calls[0][1].map((item: { symbol: string }) => item.symbol);
    const secondSymbols = scheduleSpy.mock.calls[1][1].map((item: { symbol: string }) => item.symbol);
    expect(firstSymbols).not.toContain('USER2_ONLY/KRW');
    expect(secondSymbols).not.toContain('USER1_ONLY/KRW');
  });

  it('should build included trade requests from target-weight delta and skip low-signal symbols', () => {
    const balances: any = { info: [] };
    const inferences: any[] = [
      {
        id: '1',
        batchId: 'batch-1',
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.8,
        hasStock: false,
        weight: 0.1,
        confidence: 0.8,
        modelTargetWeight: 0.15,
        buyScore: 0.75,
        sellScore: 0.2,
        action: 'buy',
      },
      {
        id: '2',
        batchId: 'batch-1',
        symbol: 'XRP/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.01,
        hasStock: false,
        weight: 0.1,
        confidence: 0.8,
        modelTargetWeight: 0,
        buyScore: 0.2,
        sellScore: 0.65,
        action: 'sell',
      },
    ];

    const currentWeights = new Map<string, number>([['ETH/KRW', 0.01]]);
    const marketPrice = 1_000_000;

    const requests = (service as any).generateIncludedTradeRequests(
      balances,
      inferences,
      5,
      1,
      currentWeights,
      marketPrice,
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('ETH/KRW');
    expect(requests[0].marketPrice).toBe(marketPrice);
    expect(requests[0].diff).toBeGreaterThan(0);
    expect(requests[0].inference.symbol).toBe('ETH/KRW');
  });

  it('should calculate model signals in 0~1 range and apply regime multiplier to target weight', () => {
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

  it('should filter out non-orderable symbols from fetched recommendations', async () => {
    cacheService.get.mockResolvedValue({
      batchId: 'stale-batch',
      hasRecommendations: true,
      updatedAt: Date.now() - MARKET_RECOMMENDATION_STATE_MAX_AGE_MS - 1,
    });

    jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue([
      {
        symbol: 'SUI/KRW',
        batchId: 'latest-batch',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(),
      },
      {
        symbol: 'XCODE/KRW',
        batchId: 'latest-batch',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(),
      },
      {
        symbol: 'FLR/USDT',
        batchId: 'latest-batch',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(),
      },
    ] as MarketRecommendation[]);

    const upbitService = (service as any).upbitService;
    upbitService.isSymbolExist
      .mockResolvedValueOnce(true) // SUI/KRW
      .mockResolvedValueOnce(false); // XCODE/KRW

    const items = await (service as any).fetchRecommendItems();

    expect(items).toEqual([
      {
        symbol: 'SUI/KRW',
        category: Category.COIN_MINOR,
        hasStock: false,
        weight: 0.2,
        confidence: 0.8,
      },
    ]);
  });

  it('should keep unchecked symbols when orderable validation partially fails', async () => {
    cacheService.get.mockResolvedValue({
      batchId: 'stale-batch',
      hasRecommendations: true,
      updatedAt: Date.now() - MARKET_RECOMMENDATION_STATE_MAX_AGE_MS - 1,
    });

    jest.spyOn(MarketRecommendation, 'getLatestRecommends').mockResolvedValue([
      {
        symbol: 'SUI/KRW',
        batchId: 'latest-batch',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(),
      },
      {
        symbol: 'XCODE/KRW',
        batchId: 'latest-batch',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(),
      },
    ] as MarketRecommendation[]);

    const upbitService = (service as any).upbitService;
    upbitService.isSymbolExist
      .mockResolvedValueOnce(true) // SUI/KRW
      .mockRejectedValueOnce(new Error('temporary failure')); // XCODE/KRW

    const items = await (service as any).fetchRecommendItems();

    expect(items.map((item: any) => item.symbol)).toEqual(['SUI/KRW', 'XCODE/KRW']);
  });

  it('should create non-balance sell requests only for orderable symbols above minimum trade amount', () => {
    const balances: any = {
      info: [
        {
          currency: 'FLR',
          unit_currency: 'KRW',
          balance: '100',
          avg_buy_price: '10',
        },
        {
          currency: 'TRX',
          unit_currency: 'KRW',
          balance: '100',
          avg_buy_price: '100',
        },
      ],
    };

    const inferences: any[] = [];
    const orderableSymbols = new Set<string>(['FLR/KRW', 'TRX/KRW']);
    const tradableMarketValueMap = new Map<string, number>([
      ['FLR/KRW', 1_000], // 최소 주문 금액 미달
      ['TRX/KRW', 10_000],
    ]);

    const requests = (service as any).generateNonBalanceRecommendationTradeRequests(
      balances,
      inferences,
      1_000_000,
      orderableSymbols,
      tradableMarketValueMap,
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('TRX/KRW');
    expect(requests[0].diff).toBe(-1);
  });

  it('should not skip excluded liquidation when tradable market value is unknown', () => {
    const balances: any = { info: [] };
    const inferences = [
      {
        symbol: 'AAA/KRW',
        category: Category.COIN_MINOR,
        intensity: 0,
        hasStock: true,
      },
    ];

    const requests = (service as any).generateExcludedTradeRequests(
      balances,
      inferences,
      1,
      1_000_000,
      new Set<string>(['AAA/KRW']),
      new Map<string, number>(),
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('AAA/KRW');
    expect(requests[0].diff).toBe(-1);
  });

  it('should skip inference notify when no authorized recommendations are available', async () => {
    const notifyService = (service as any).notifyService;
    const upbitService = (service as any).upbitService;
    const historyService = (service as any).historyService;

    jest.spyOn(service as any, 'filterUserAuthorizedBalanceRecommendations').mockResolvedValue([]);

    const result = await service.executeRebalanceForUser({ id: 'user-1' } as any, [
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
      } as any,
    ]);

    expect(result).toEqual([]);
    expect(notifyService.notify).not.toHaveBeenCalled();
    expect(upbitService.getBalances).not.toHaveBeenCalled();
    expect(historyService.saveHistoryForUser).not.toHaveBeenCalled();
    expect(upbitService.clearClients).toHaveBeenCalledTimes(1);
    expect(notifyService.clearClients).toHaveBeenCalledTimes(1);
  });

  it('should override hasStock flag using the requesting user history', async () => {
    const historyService = (service as any).historyService;
    const filterSpy = jest.spyOn(service as any, 'filterUserAuthorizedBalanceRecommendations').mockResolvedValue([]);

    historyService.fetchHistoryByUser.mockResolvedValueOnce([
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ]);

    await service.executeRebalanceForUser(
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

    const passedInferences = filterSpy.mock.calls[0][1];
    expect(passedInferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: 'BTC/KRW', hasStock: false }),
        expect.objectContaining({ symbol: 'ETH/KRW', hasStock: true }),
      ]),
    );
  });

  it('should not rewrite history when balances are unavailable', async () => {
    const upbitService = (service as any).upbitService;
    const historyService = (service as any).historyService;

    const authorizedInferences = [
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.5,
        modelTargetWeight: 0.5,
        action: 'buy',
        hasStock: true,
      },
    ];

    jest.spyOn(service as any, 'filterUserAuthorizedBalanceRecommendations').mockResolvedValue(authorizedInferences);
    upbitService.getBalances.mockResolvedValue(null);

    const result = await service.executeRebalanceForUser(
      { id: 'user-1', roles: [] } as any,
      authorizedInferences as any,
      'new',
    );

    expect(result).toEqual([]);
    expect(historyService.saveHistoryForUser).not.toHaveBeenCalled();
    expect(upbitService.clearClients).toHaveBeenCalledTimes(1);
  });

  it('should not persist inferred buys when buy execution fails', async () => {
    const upbitService = (service as any).upbitService;
    const historyService = (service as any).historyService;
    const balances: any = { info: [] };
    const user: any = { id: 'user-1', roles: [] };

    const inferences = [
      {
        id: 'inference-1',
        batchId: 'batch-1',
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.7,
        modelTargetWeight: 0.7,
        action: 'buy',
        hasStock: false,
      },
    ];

    historyService.fetchHistoryByUser.mockResolvedValue([]);
    upbitService.getBalances.mockResolvedValue(balances);
    upbitService.calculateTradableMarketValue = jest.fn().mockResolvedValue(1_000_000);

    jest.spyOn(service as any, 'filterUserAuthorizedBalanceRecommendations').mockResolvedValue(inferences);
    jest.spyOn(service as any, 'getItemCount').mockResolvedValue(1);
    jest.spyOn(service as any, 'getMarketRegimeMultiplier').mockResolvedValue(1);
    jest.spyOn(service as any, 'buildCurrentWeightMap').mockResolvedValue(new Map());
    jest.spyOn(service as any, 'generateNonBalanceRecommendationTradeRequests').mockReturnValue([]);
    jest.spyOn(service as any, 'generateExcludedTradeRequests').mockReturnValue([]);
    jest
      .spyOn(service as any, 'generateIncludedTradeRequests')
      .mockReturnValueOnce([])
      .mockReturnValueOnce([
        {
          symbol: 'ETH/KRW',
          diff: 0.4,
          balances,
          marketPrice: 1_000_000,
          inference: inferences[0],
        },
      ]);
    jest.spyOn(service as any, 'executeTrade').mockResolvedValue(null);

    await service.executeRebalanceForUser(user, inferences as any, 'new');

    expect(historyService.saveHistoryForUser).toHaveBeenCalledWith(user, []);
  });

  it('should persist history using executed buys and full liquidations', async () => {
    const historyService = (service as any).historyService;

    historyService.fetchHistoryByUser.mockResolvedValueOnce([
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ]);

    await (service as any).saveRebalanceHistoryForUser(
      { id: 'user-1' } as any,
      [{ symbol: 'ETH/KRW', category: Category.COIN_MAJOR }],
      [{ symbol: 'XRP/KRW', category: Category.COIN_MINOR }],
    );

    const [, savedItems] = historyService.saveHistoryForUser.mock.calls[0];
    expect(savedItems).toHaveLength(2);
    expect(savedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: 'BTC/KRW', category: Category.COIN_MAJOR }),
        expect.objectContaining({ symbol: 'XRP/KRW', category: Category.COIN_MINOR }),
      ]),
    );
    expect(savedItems.some((item: { symbol: string }) => item.symbol === 'ETH/KRW')).toBe(false);
  });

  it('should collect full liquidation items without inference using existing history', () => {
    const liquidatedItems = (service as any).collectLiquidatedHistoryItems(
      [
        {
          request: {
            symbol: 'XRP/KRW',
            diff: -1,
            balances: { info: [] },
          },
          trade: {
            type: OrderTypes.SELL,
          },
        },
      ],
      [
        {
          symbol: 'XRP/KRW',
          category: Category.COIN_MINOR,
          hasStock: true,
        },
      ],
    );

    expect(liquidatedItems).toEqual([{ symbol: 'XRP/KRW', category: Category.COIN_MINOR }]);
  });

  it('should block trade-request backfill in existing portfolio mode', () => {
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
      undefined,
      undefined,
      false,
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('ETH/KRW');
  });

  it('should fallback to target symbol when AI returns symbol mismatch', async () => {
    const openaiService = (service as any).openaiService;
    const featureService = (service as any).featureService;

    jest.spyOn(BalanceRecommendation, 'find').mockResolvedValue([]);
    featureService.extractMarketFeatures.mockResolvedValue(null);
    featureService.formatMarketData.mockReturnValue('market-data');
    openaiService.createResponse.mockResolvedValue({} as any);
    openaiService.getResponseOutput.mockReturnValue({
      text: JSON.stringify({
        symbol: 'BTC',
        intensity: 0.42,
      }),
      citations: [],
    });

    const saveSpy = jest.spyOn(service, 'saveBalanceRecommendation').mockImplementation(async (recommendation) => {
      return {
        id: 'saved-1',
        seq: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        reason: null,
        ...recommendation,
      } as any;
    });

    const result = await service.balanceRecommendation([
      {
        symbol: 'BTC',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ]);

    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'BTC/KRW' }));
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTC/KRW');
  });

  it('should keep raw reason for persistence and return sanitized reason', async () => {
    const openaiService = (service as any).openaiService;
    const featureService = (service as any).featureService;

    jest.spyOn(BalanceRecommendation, 'find').mockResolvedValue([]);
    featureService.extractMarketFeatures.mockResolvedValue(null);
    featureService.formatMarketData.mockReturnValue('market-data');
    openaiService.createResponse.mockResolvedValue({} as any);
    openaiService.getResponseOutput.mockReturnValue({
      text: JSON.stringify({
        symbol: 'BTC/KRW',
        intensity: 0.31,
        reason: '근거 문장 〖4:0†source〗',
      }),
      citations: [],
    });

    const saveSpy = jest.spyOn(service, 'saveBalanceRecommendation').mockImplementation(async (recommendation) => {
      return {
        id: 'saved-2',
        seq: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...recommendation,
      } as any;
    });

    const result = await service.balanceRecommendation([
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ]);

    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ reason: '근거 문장 〖4:0†source〗' }));
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('근거 문장');
  });

  it('should skip profit notify when no trades are executed in SQS message handling', async () => {
    const profitService = (service as any).profitService;
    const notifyService = (service as any).notifyService;

    jest.spyOn(service, 'executeRebalanceForUser').mockResolvedValue([]);
    const sqsSendMock = jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);

    await (service as any).handleMessage({
      MessageId: 'message-1',
      ReceiptHandle: 'receipt-1',
      Body: JSON.stringify({
        version: 2,
        module: 'rebalance',
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
      QueueUrl: process.env.AWS_SQS_QUEUE_URL_REBALANCE,
      ReceiptHandle: 'receipt-1',
    });
    expect((service as any).tradeExecutionLedgerService.markSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptCount: 1,
      }),
    );
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
        module: 'rebalance',
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
      QueueUrl: process.env.AWS_SQS_QUEUE_URL_REBALANCE,
      ReceiptHandle: 'receipt-processing',
      VisibilityTimeout: 300,
    });
    expect(ledgerService.markSucceeded).not.toHaveBeenCalled();
    expect(ledgerService.markRetryableFailed).not.toHaveBeenCalled();
  });

  it('should process legacy rebalance message shape during migration', async () => {
    const executeSpy = jest.spyOn(service, 'executeRebalanceForUser').mockResolvedValue([]);
    const sqsSendMock = jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);

    await (service as any).handleMessage({
      MessageId: 'legacy-message-1',
      ReceiptHandle: 'receipt-legacy-1',
      Body: JSON.stringify({
        type: 'rebalance',
        user: { id: 'user-1' },
        inferences: [],
      }),
    });

    expect(executeSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), [], 'new');
    expect((service as any).tradeExecutionLedgerService.markSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
      }),
    );
    expect(sqsSendMock).toHaveBeenCalledTimes(1);
    expect((sqsSendMock.mock.calls[0][0] as any).input).toMatchObject({
      QueueUrl: process.env.AWS_SQS_QUEUE_URL_REBALANCE,
      ReceiptHandle: 'receipt-legacy-1',
    });
  });

  it('should not mark malformed message as non-retryable when ledger is already processing', async () => {
    const ledgerService = (service as any).tradeExecutionLedgerService;
    const sqsSendMock = jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);
    ledgerService.acquire.mockResolvedValueOnce({
      acquired: false,
      status: 'processing',
    });

    await (service as any).handleMessage({
      MessageId: 'malformed-message-1',
      ReceiptHandle: 'receipt-malformed-1',
      Body: JSON.stringify({
        version: 1,
        module: 'rebalance',
        messageKey: 'run-malformed:user-1',
        userId: 'user-1',
      }),
    });

    expect(ledgerService.markNonRetryableFailed).not.toHaveBeenCalled();
    expect(sqsSendMock).toHaveBeenCalledTimes(1);
    expect((sqsSendMock.mock.calls[0][0] as any).input).toMatchObject({
      QueueUrl: process.env.AWS_SQS_QUEUE_URL_REBALANCE,
      ReceiptHandle: 'receipt-malformed-1',
    });
  });

  it('should not downgrade succeeded ledger status when delete message fails', async () => {
    const ledgerService = (service as any).tradeExecutionLedgerService;
    jest.spyOn(service, 'executeRebalanceForUser').mockResolvedValue([]);
    jest.spyOn((service as any).sqs, 'send').mockRejectedValueOnce(new Error('delete failed'));

    await expect(
      (service as any).handleMessage({
        MessageId: 'message-delete-fail',
        ReceiptHandle: 'receipt-delete-fail',
        Body: JSON.stringify({
          version: 2,
          module: 'rebalance',
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
