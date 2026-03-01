import { TradeOrchestrationService } from '../allocation-core/trade-orchestration.service';
import { Category } from '../category/category.enum';
import { MarketSignal } from '../market-intelligence/entities/market-signal.entity';
import { MARKET_SIGNAL_STATE_MAX_AGE_MS } from '../market-intelligence/market-intelligence.types';
import { OrderTypes } from '../upbit/upbit.enum';
import { AllocationService } from './allocation.service';
import { AllocationRecommendation } from './entities/allocation-recommendation.entity';

describe('AllocationService', () => {
  let service: AllocationService;
  let cacheService: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  const originalQueueUrl = process.env.AWS_SQS_QUEUE_URL_ALLOCATION;

  beforeAll(() => {
    process.env.AWS_SQS_QUEUE_URL_ALLOCATION = 'https://example.com/test-allocation-queue';
  });

  afterAll(() => {
    if (originalQueueUrl == null) {
      delete process.env.AWS_SQS_QUEUE_URL_ALLOCATION;
      return;
    }

    process.env.AWS_SQS_QUEUE_URL_ALLOCATION = originalQueueUrl;
  });

  beforeEach(() => {
    cacheService = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    service = new AllocationService(
      {
        t: jest.fn((key: string) => key),
      } as any,
      {
        findAll: jest.fn().mockResolvedValue([]),
      } as any,
      {
        fetchHoldingsByUsers: jest.fn().mockResolvedValue([]),
        fetchHoldingsByUser: jest.fn().mockResolvedValue([]),
        replaceHoldingsForUser: jest.fn().mockResolvedValue(undefined),
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
        resolveAuthorizedSlotCount: jest.fn().mockResolvedValue(5),
      } as any,
      new TradeOrchestrationService(),
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
        getSnapshot: jest.fn().mockResolvedValue({
          btcDominance: 55,
          altcoinIndex: 50,
          asOf: new Date(),
          source: 'live',
          isStale: false,
          staleAgeMinutes: 0,
        }),
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
        enqueueAllocationBatchValidation: jest.fn().mockResolvedValue(undefined),
        buildAllocationValidationGuardrailText: jest.fn().mockResolvedValue(null),
        getAllocationValidationBadgeMap: jest.fn().mockResolvedValue(new Map()),
        getRecommendedMarketMinConfidenceForAllocation: jest.fn().mockResolvedValue(0.55),
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
      updatedAt: Date.now() - MARKET_SIGNAL_STATE_MAX_AGE_MS - 1,
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
    ] as MarketSignal[];

    const latestSpy = jest.spyOn(MarketSignal, 'getLatestSignals').mockResolvedValue(latestRecommendations);

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

    const latestSpy = jest.spyOn(MarketSignal, 'getLatestSignals').mockResolvedValue([
      {
        symbol: 'ETH/KRW',
        batchId: 'batch-empty',
        weight: 0.2,
        confidence: 0.8,
        createdAt: new Date(updatedAt - 60_000),
      },
    ] as MarketSignal[]);

    const findSpy = jest.spyOn(MarketSignal, 'find');

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

    const findSpy = jest.spyOn(MarketSignal, 'find').mockResolvedValue([
      {
        symbol: 'OLD/KRW',
        batchId: 'batch-a',
        weight: 0.3,
        confidence: 0.9,
        createdAt: new Date(updatedAt - 10_000),
      },
    ] as MarketSignal[]);

    const latestSpy = jest.spyOn(MarketSignal, 'getLatestSignals').mockResolvedValue([
      {
        symbol: 'NEW/KRW',
        batchId: 'batch-b',
        weight: 0.15,
        confidence: 0.7,
        createdAt: new Date(updatedAt - 5_000),
      },
    ] as MarketSignal[]);

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

  it('should schedule new allocation once with user-scoped holdings symbols', async () => {
    const scheduleService = (service as any).scheduleService;
    const holdingLedgerService = (service as any).holdingLedgerService;
    const users = [
      { id: 'user-1', roles: [] },
      { id: 'user-2', roles: [] },
    ];

    scheduleService.getUsers.mockResolvedValue(users);
    holdingLedgerService.fetchHoldingsByUser
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
    const scheduleSpy = jest.spyOn(service as any, 'scheduleAllocation').mockResolvedValue(undefined);

    await service.executeAllocationRecommendationNewTask();

    expect(holdingLedgerService.fetchHoldingsByUsers).not.toHaveBeenCalled();
    expect(holdingLedgerService.fetchHoldingsByUser).toHaveBeenCalledTimes(2);
    expect(holdingLedgerService.fetchHoldingsByUser).toHaveBeenNthCalledWith(1, users[0]);
    expect(holdingLedgerService.fetchHoldingsByUser).toHaveBeenNthCalledWith(2, users[1]);
    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    const scheduledSymbols = scheduleSpy.mock.calls[0][1].map((item: { symbol: string }) => item.symbol);
    expect(scheduledSymbols).toEqual(
      expect.arrayContaining(['USER1_ONLY/KRW', 'USER2_ONLY/KRW', 'BTC/KRW', 'ETH/KRW']),
    );
    const user1Item = scheduleSpy.mock.calls[0][1].find(
      (item: { symbol: string; hasStock: boolean }) => item.symbol === 'USER1_ONLY/KRW',
    );
    const user2Item = scheduleSpy.mock.calls[0][1].find(
      (item: { symbol: string; hasStock: boolean }) => item.symbol === 'USER2_ONLY/KRW',
    );
    expect(user1Item?.hasStock).toBe(false);
    expect(user2Item?.hasStock).toBe(false);
    expect(scheduleSpy).toHaveBeenCalledWith(users, expect.any(Array), 'new', expect.any(Map));

    const scopeByUser = scheduleSpy.mock.calls[0][3] as Map<string, Set<string>>;
    expect(scopeByUser.get(users[0].id)).toEqual(expect.any(Set));
    expect(scopeByUser.get(users[1].id)).toEqual(expect.any(Set));
    expect(scopeByUser.get(users[0].id)?.has('USER1_ONLY/KRW')).toBe(true);
    expect(scopeByUser.get(users[0].id)?.has('USER2_ONLY/KRW')).toBe(false);
    expect(scopeByUser.get(users[1].id)?.has('USER2_ONLY/KRW')).toBe(true);
    expect(scopeByUser.get(users[1].id)?.has('USER1_ONLY/KRW')).toBe(false);
    expect(scopeByUser.get(users[0].id)?.has('BTC/KRW')).toBe(true);
    expect(scopeByUser.get(users[1].id)?.has('BTC/KRW')).toBe(true);
    expect(scopeByUser.get(users[0].id)?.has('ETH/KRW')).toBe(true);
    expect(scopeByUser.get(users[1].id)?.has('ETH/KRW')).toBe(true);
  });

  it('should skip users with holdings fetch failure in new allocation mode', async () => {
    const scheduleService = (service as any).scheduleService;
    const holdingLedgerService = (service as any).holdingLedgerService;
    const users = [
      { id: 'user-1', roles: [] },
      { id: 'user-2', roles: [] },
    ];

    scheduleService.getUsers.mockResolvedValue(users);
    holdingLedgerService.fetchHoldingsByUser
      .mockResolvedValueOnce([
        {
          symbol: 'USER1_ONLY/KRW',
          category: Category.COIN_MINOR,
          hasStock: true,
        },
      ])
      .mockRejectedValueOnce(new Error('holdings fetch failed'));

    jest.spyOn(service as any, 'fetchMajorCoinItems').mockResolvedValue([]);
    jest.spyOn(service as any, 'fetchRecommendItems').mockResolvedValue([]);
    const scheduleSpy = jest.spyOn(service as any, 'scheduleAllocation').mockResolvedValue(undefined);

    await service.executeAllocationRecommendationNewTask();

    expect(holdingLedgerService.fetchHoldingsByUser).toHaveBeenCalledTimes(2);
    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    expect(scheduleSpy).toHaveBeenCalledWith([users[0]], expect.any(Array), 'new', expect.any(Map));
    const scopeByUser = scheduleSpy.mock.calls[0][3] as Map<string, Set<string>>;
    expect(scopeByUser.has(users[0].id)).toBe(true);
    expect(scopeByUser.has(users[1].id)).toBe(false);
  });

  it('should schedule existing allocation once with merged user holdings', async () => {
    const scheduleService = (service as any).scheduleService;
    const holdingLedgerService = (service as any).holdingLedgerService;
    const users = [
      { id: 'user-1', roles: [] },
      { id: 'user-2', roles: [] },
    ];

    scheduleService.getUsers.mockResolvedValue(users);
    holdingLedgerService.fetchHoldingsByUser
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
      .spyOn(service as any, 'filterAllocationRecommendations')
      .mockImplementation(async (items: Array<{ symbol: string; category: Category; hasStock: boolean }>) => items);
    const scheduleSpy = jest.spyOn(service as any, 'scheduleAllocation').mockResolvedValue(undefined);

    await service.executeAllocationRecommendationExistingTask();

    expect(holdingLedgerService.fetchHoldingsByUsers).not.toHaveBeenCalled();
    expect(holdingLedgerService.fetchHoldingsByUser).toHaveBeenCalledTimes(2);
    expect(holdingLedgerService.fetchHoldingsByUser).toHaveBeenNthCalledWith(1, users[0]);
    expect(holdingLedgerService.fetchHoldingsByUser).toHaveBeenNthCalledWith(2, users[1]);
    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    expect(scheduleSpy).toHaveBeenCalledWith(users, expect.any(Array), 'existing', expect.any(Map));
    const scheduledSymbols = scheduleSpy.mock.calls[0][1].map((item: { symbol: string }) => item.symbol);
    expect(scheduledSymbols).toEqual(expect.arrayContaining(['USER1_ONLY/KRW', 'USER2_ONLY/KRW']));

    const scopeByUser = scheduleSpy.mock.calls[0][3] as Map<string, Set<string>>;
    expect(scopeByUser.get(users[0].id)).toEqual(expect.any(Set));
    expect(scopeByUser.get(users[1].id)).toEqual(expect.any(Set));
    expect(scopeByUser.get(users[0].id)?.has('USER1_ONLY/KRW')).toBe(true);
    expect(scopeByUser.get(users[0].id)?.has('USER2_ONLY/KRW')).toBe(false);
    expect(scopeByUser.get(users[1].id)?.has('USER2_ONLY/KRW')).toBe(true);
    expect(scopeByUser.get(users[1].id)?.has('USER1_ONLY/KRW')).toBe(false);
  });

  it('should retain recommend metadata when holdings overlaps in new allocation mode', async () => {
    const scheduleService = (service as any).scheduleService;
    const holdingLedgerService = (service as any).holdingLedgerService;
    const users = [
      { id: 'user-1', roles: [] },
      { id: 'user-2', roles: [] },
    ];

    scheduleService.getUsers.mockResolvedValue(users);
    holdingLedgerService.fetchHoldingsByUser
      .mockResolvedValueOnce([
        {
          symbol: 'ETH/KRW',
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

    jest.spyOn(service as any, 'fetchMajorCoinItems').mockResolvedValue([]);
    jest.spyOn(service as any, 'fetchRecommendItems').mockResolvedValue([
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MINOR,
        hasStock: false,
        weight: 0.22,
        confidence: 0.88,
      },
    ]);
    const scheduleSpy = jest.spyOn(service as any, 'scheduleAllocation').mockResolvedValue(undefined);

    await service.executeAllocationRecommendationNewTask();

    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    const scheduledItems = scheduleSpy.mock.calls[0][1] as Array<{
      symbol: string;
      hasStock: boolean;
      weight?: number;
      confidence?: number;
    }>;
    const overlappingEthItems = scheduledItems.filter((item) => item.symbol === 'ETH/KRW');
    expect(overlappingEthItems).toHaveLength(1);
    expect(overlappingEthItems[0]).toMatchObject({
      symbol: 'ETH/KRW',
      hasStock: false,
      weight: 0.22,
      confidence: 0.88,
    });

    const scopeByUser = scheduleSpy.mock.calls[0][3] as Map<string, Set<string>>;
    expect(scopeByUser.get(users[0].id)?.has('ETH/KRW')).toBe(true);
    expect(scopeByUser.get(users[1].id)?.has('ETH/KRW')).toBe(true);
  });

  it('should skip users without holdings in existing allocation mode', async () => {
    const scheduleService = (service as any).scheduleService;
    const holdingLedgerService = (service as any).holdingLedgerService;
    const users = [
      { id: 'user-1', roles: [] },
      { id: 'user-2', roles: [] },
    ];

    scheduleService.getUsers.mockResolvedValue(users);
    holdingLedgerService.fetchHoldingsByUser
      .mockResolvedValueOnce([
        {
          symbol: 'USER1_ONLY/KRW',
          category: Category.COIN_MINOR,
          hasStock: true,
        },
      ])
      .mockResolvedValueOnce([]);

    jest
      .spyOn(service as any, 'filterAllocationRecommendations')
      .mockImplementation(async (items: Array<{ symbol: string; category: Category; hasStock: boolean }>) => items);
    const scheduleSpy = jest.spyOn(service as any, 'scheduleAllocation').mockResolvedValue(undefined);

    await service.executeAllocationRecommendationExistingTask();

    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    expect(scheduleSpy).toHaveBeenCalledWith([users[0]], expect.any(Array), 'existing', expect.any(Map));
    const scheduledSymbols = scheduleSpy.mock.calls[0][1].map((item: { symbol: string }) => item.symbol);
    expect(scheduledSymbols).toEqual(expect.arrayContaining(['USER1_ONLY/KRW']));
    const scopeByUser = scheduleSpy.mock.calls[0][3] as Map<string, Set<string>>;
    expect(scopeByUser.get(users[0].id)?.has('USER1_ONLY/KRW')).toBe(true);
    expect(scopeByUser.has(users[1].id)).toBe(false);
  });

  it('should keep existing allocation running when one user holdings fetch fails', async () => {
    const scheduleService = (service as any).scheduleService;
    const holdingLedgerService = (service as any).holdingLedgerService;
    const users = [
      { id: 'user-1', roles: [] },
      { id: 'user-2', roles: [] },
    ];

    scheduleService.getUsers.mockResolvedValue(users);
    holdingLedgerService.fetchHoldingsByUser
      .mockResolvedValueOnce([
        {
          symbol: 'USER1_ONLY/KRW',
          category: Category.COIN_MINOR,
          hasStock: true,
        },
      ])
      .mockRejectedValueOnce(new Error('holdings fetch failed'));

    jest
      .spyOn(service as any, 'filterAllocationRecommendations')
      .mockImplementation(async (items: Array<{ symbol: string; category: Category; hasStock: boolean }>) => items);
    const scheduleSpy = jest.spyOn(service as any, 'scheduleAllocation').mockResolvedValue(undefined);

    await service.executeAllocationRecommendationExistingTask();

    expect(holdingLedgerService.fetchHoldingsByUser).toHaveBeenCalledTimes(2);
    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    expect(scheduleSpy).toHaveBeenCalledWith([users[0]], expect.any(Array), 'existing', expect.any(Map));
    const scopeByUser = scheduleSpy.mock.calls[0][3] as Map<string, Set<string>>;
    expect(scopeByUser.has(users[0].id)).toBe(true);
    expect(scopeByUser.has(users[1].id)).toBe(false);
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

  it('should create positive included trade diff with conviction-normalized sizing', () => {
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
    expect(requests[0].diff).toBeGreaterThan(0);
    expect(requests[0].diff).toBeLessThanOrEqual(1);
  });

  it('should enforce regime-based category exposure caps when creating included trade requests', () => {
    const balances: any = { info: [] };
    const currentWeights = new Map<string, number>();
    const inferences = [
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.9,
        hasStock: false,
        modelTargetWeight: 0.8,
        confidence: 0.9,
      },
      {
        symbol: 'XRP/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: false,
        modelTargetWeight: 0.8,
        confidence: 0.9,
      },
      {
        symbol: 'ADA/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: false,
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
      true,
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

  it('should not consume category cap when included request is skipped by cost gate', () => {
    const balances: any = { info: [] };
    const currentWeights = new Map<string, number>();
    const inferences = [
      {
        symbol: 'SKIP/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: false,
        modelTargetWeight: 0.8,
        expectedEdgeRate: 0.0001,
        estimatedCostRate: 0.02,
      },
      {
        symbol: 'KEEP/KRW',
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: false,
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
      true,
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

  it('should generate trim-only sell request for overweight hold/no_trade recommendation', () => {
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
      true,
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('BTC/KRW');
    expect(requests[0].diff).toBeCloseTo(-0.8, 10);
    expect(requests[0].diff).toBeGreaterThan(-1);
  });

  it('should not generate trim-only sell request when hold/no_trade recommendation is not overweight', () => {
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
      true,
    );

    expect(requests).toHaveLength(0);
  });

  it('should not consume category cap when no-trade trim request is skipped by minimum sell amount', () => {
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
      true,
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

  it('should cap included trade requests to 5 slots when minor recommendations are 7', () => {
    const balances: any = { info: [] };
    const currentWeights = new Map<string, number>();
    const inferences = Array.from({ length: 7 }, (_, index) => ({
      symbol: `MINOR${index + 1}/KRW`,
      category: Category.COIN_MINOR,
      intensity: 0.9,
      hasStock: false,
      modelTargetWeight: 1,
      action: 'buy',
    }));

    const requests = (service as any).generateIncludedTradeRequests(
      balances,
      inferences,
      5,
      1,
      currentWeights,
      1_000_000,
    );

    expect(requests).toHaveLength(5);
  });

  it('should cap included trade requests to 5 slots when merged category recommendations are 7', () => {
    const balances: any = { info: [] };
    const currentWeights = new Map<string, number>();
    const inferences = [
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.9,
        hasStock: false,
        modelTargetWeight: 1,
        action: 'buy',
      },
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.9,
        hasStock: false,
        modelTargetWeight: 1,
        action: 'buy',
      },
      ...Array.from({ length: 5 }, (_, index) => ({
        symbol: `MINOR${index + 1}/KRW`,
        category: Category.COIN_MINOR,
        intensity: 0.9,
        hasStock: false,
        modelTargetWeight: 1,
        action: 'buy',
      })),
    ];

    const requests = (service as any).generateIncludedTradeRequests(
      balances,
      inferences,
      5,
      1,
      currentWeights,
      1_000_000,
    );

    expect(requests).toHaveLength(5);
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
      updatedAt: Date.now() - MARKET_SIGNAL_STATE_MAX_AGE_MS - 1,
    });

    jest.spyOn(MarketSignal, 'getLatestSignals').mockResolvedValue([
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
    ] as MarketSignal[]);

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
      updatedAt: Date.now() - MARKET_SIGNAL_STATE_MAX_AGE_MS - 1,
    });

    jest.spyOn(MarketSignal, 'getLatestSignals').mockResolvedValue([
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
    ] as MarketSignal[]);

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

    const requests = (service as any).generateNonAllocationRecommendationTradeRequests(
      balances,
      inferences,
      1_000_000,
      orderableSymbols,
      tradableMarketValueMap,
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].symbol).toBe('TRX/KRW');
    expect(requests[0].diff).toBeLessThan(0);
    expect(requests[0].diff).toBeGreaterThanOrEqual(-1);
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
    expect(requests[0].diff).toBeLessThan(0);
    expect(requests[0].diff).toBeGreaterThanOrEqual(-1);
  });

  it('should delay missing-inference liquidation until grace window elapses', async () => {
    const user = { id: 'user-1' } as any;
    const request = {
      symbol: 'TRX/KRW',
      diff: -0.5,
      balances: { info: [] },
      marketPrice: 1_000_000,
    } as any;

    cacheService.get.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    const first = await (service as any).applyMissingInferenceGraceWindow(user, [request], new Set<string>());
    const second = await (service as any).applyMissingInferenceGraceWindow(user, [request], new Set<string>());

    expect(first).toEqual([]);
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({
      symbol: 'TRX/KRW',
      triggerReason: 'missing_inference_grace_elapsed',
    });
    expect(cacheService.set).toHaveBeenCalledTimes(2);
  });

  it('should clear missing-inference counters for symbols that re-enter inference', async () => {
    await (service as any).applyMissingInferenceGraceWindow({ id: 'user-1' } as any, [], new Set<string>(['BTC/KRW']));

    expect(cacheService.del).toHaveBeenCalledWith('allocation:missing-inference:user-1:BTC/KRW');
  });

  it('should cap sell and buy executions by regime turnover cap in allocation mode', async () => {
    const categoryService = (service as any).categoryService;
    const upbitService = (service as any).upbitService;
    const holdingLedgerService = (service as any).holdingLedgerService;
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
        intensity: 0.6,
        modelTargetWeight: 0.6,
        action: 'buy',
        hasStock: false,
      },
    ];

    categoryService.findEnabledByUser.mockResolvedValue([{ category: Category.COIN_MAJOR }]);
    categoryService.checkCategoryPermission.mockReturnValue(true);
    holdingLedgerService.fetchHoldingsByUser.mockResolvedValue([]);
    upbitService.getBalances.mockResolvedValueOnce(balances).mockResolvedValueOnce(balances);
    upbitService.calculateTradableMarketValue = jest.fn().mockResolvedValue(1_000_000);
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

    jest.spyOn(service as any, 'generateNonAllocationRecommendationTradeRequests').mockReturnValue(sellRequests);
    jest.spyOn(service as any, 'applyMissingInferenceGraceWindow').mockResolvedValue(sellRequests);
    jest.spyOn(service as any, 'generateExcludedTradeRequests').mockReturnValue([]);
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

    await service.executeAllocationForUser(user, inferences as any, 'new');

    expect(executeTradeSpy).toHaveBeenCalledTimes(2);
    expect(executeTradeSpy.mock.calls.map((call) => call[0].request.symbol)).toEqual(['SELL-1/KRW', 'BUY-1/KRW']);
  });

  it('should skip inference notify when no authorized recommendations are available', async () => {
    const categoryService = (service as any).categoryService;
    const notifyService = (service as any).notifyService;
    const upbitService = (service as any).upbitService;
    const holdingLedgerService = (service as any).holdingLedgerService;

    categoryService.findEnabledByUser.mockResolvedValue([]);

    const result = await service.executeAllocationForUser({ id: 'user-1' } as any, [
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
      } as any,
    ]);

    expect(result).toEqual([]);
    expect(notifyService.notify).not.toHaveBeenCalled();
    expect(upbitService.getBalances).not.toHaveBeenCalled();
    expect(holdingLedgerService.replaceHoldingsForUser).not.toHaveBeenCalled();
    expect(upbitService.clearClients).toHaveBeenCalledTimes(1);
    expect(notifyService.clearClients).toHaveBeenCalledTimes(1);
  });

  it('should override hasStock flag using the requesting user holdings', async () => {
    const categoryService = (service as any).categoryService;
    const upbitService = (service as any).upbitService;
    const holdingLedgerService = (service as any).holdingLedgerService;
    const excludedSpy = jest.spyOn(service as any, 'generateExcludedTradeRequests').mockReturnValue([]);
    jest.spyOn(service as any, 'generateNonAllocationRecommendationTradeRequests').mockReturnValue([]);
    jest.spyOn(service as any, 'generateIncludedTradeRequests').mockReturnValue([]);

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
    upbitService.calculateTradableMarketValue = jest.fn().mockResolvedValue(1_000_000);

    await service.executeAllocationForUser(
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

    const passedInferences = excludedSpy.mock.calls[0][1];
    expect(passedInferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ symbol: 'BTC/KRW', hasStock: false }),
        expect.objectContaining({ symbol: 'ETH/KRW', hasStock: true }),
      ]),
    );
  });

  it('should not rewrite holdings when balances are unavailable', async () => {
    const categoryService = (service as any).categoryService;
    const upbitService = (service as any).upbitService;
    const holdingLedgerService = (service as any).holdingLedgerService;

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

    categoryService.findEnabledByUser.mockResolvedValue([{ category: Category.COIN_MAJOR }]);
    categoryService.checkCategoryPermission.mockReturnValue(true);
    upbitService.getBalances.mockResolvedValue(null);

    const result = await service.executeAllocationForUser(
      { id: 'user-1', roles: [] } as any,
      authorizedInferences as any,
      'new',
    );

    expect(result).toEqual([]);
    expect(holdingLedgerService.replaceHoldingsForUser).not.toHaveBeenCalled();
    expect(upbitService.clearClients).toHaveBeenCalledTimes(1);
  });

  it('should not persist inferred buys when buy execution fails', async () => {
    const categoryService = (service as any).categoryService;
    const upbitService = (service as any).upbitService;
    const holdingLedgerService = (service as any).holdingLedgerService;
    const tradeOrchestrationService = (service as any).tradeOrchestrationService;
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

    holdingLedgerService.fetchHoldingsByUser.mockResolvedValue([]);
    upbitService.getBalances.mockResolvedValue(balances);
    upbitService.calculateTradableMarketValue = jest.fn().mockResolvedValue(1_000_000);
    categoryService.findEnabledByUser.mockResolvedValue([{ category: Category.COIN_MAJOR }]);
    categoryService.checkCategoryPermission.mockReturnValue(true);

    jest.spyOn(service as any, 'generateNonAllocationRecommendationTradeRequests').mockReturnValue([]);
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
    jest.spyOn(tradeOrchestrationService, 'executeTrade').mockResolvedValue(null);

    await service.executeAllocationForUser(user, inferences as any, 'new');

    expect(holdingLedgerService.replaceHoldingsForUser).toHaveBeenCalledWith(user, []);
  });

  it('should skip trade persistence when adjusted order has no executed fill', async () => {
    const upbitService = (service as any).upbitService;
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
    });
    upbitService.getOrderType = jest.fn().mockReturnValue(OrderTypes.BUY);
    upbitService.calculateAmount = jest.fn().mockResolvedValue(100_000);
    upbitService.calculateProfit = jest.fn().mockResolvedValue(0);

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

  it('should block trade-request backfill in existing allocation mode', () => {
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

  it('should apply category-based 5 slots in new allocation mode', async () => {
    const categoryService = (service as any).categoryService;
    const upbitService = (service as any).upbitService;
    const balances: any = { info: [] };
    const user: any = { id: 'user-1', roles: [] };
    const inferences = [
      {
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.8,
        modelTargetWeight: 0.8,
        action: 'buy',
        hasStock: false,
      },
      {
        symbol: 'ETH/KRW',
        category: Category.COIN_MAJOR,
        intensity: 0.8,
        modelTargetWeight: 0.8,
        action: 'buy',
        hasStock: false,
      },
      ...Array.from({ length: 5 }, (_, index) => ({
        symbol: `MINOR${index + 1}/KRW`,
        category: Category.COIN_MINOR,
        intensity: 0.8,
        modelTargetWeight: 0.8,
        action: 'buy',
        hasStock: false,
      })),
    ];

    categoryService.findEnabledByUser.mockResolvedValue([
      { category: Category.COIN_MAJOR },
      { category: Category.COIN_MINOR },
    ]);
    categoryService.checkCategoryPermission.mockReturnValue(true);
    upbitService.getBalances.mockResolvedValueOnce(balances).mockResolvedValueOnce(balances);
    upbitService.calculateTradableMarketValue = jest.fn().mockResolvedValue(1_000_000);

    jest.spyOn(service as any, 'generateNonAllocationRecommendationTradeRequests').mockReturnValue([]);
    const excludedSpy = jest.spyOn(service as any, 'generateExcludedTradeRequests').mockReturnValue([]);
    const includedSpy = jest.spyOn(service as any, 'generateIncludedTradeRequests').mockReturnValue([]);

    const result = await service.executeAllocationForUser(user, inferences as any, 'new');

    expect(result).toEqual([]);
    expect(excludedSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      5,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      true,
    );
    expect(includedSpy).toHaveBeenCalledTimes(2);
    expect(includedSpy.mock.calls[0][2]).toBe(5);
    expect(includedSpy.mock.calls[0][8]).toBe(true);
    expect(includedSpy.mock.calls[1][2]).toBe(5);
    expect(includedSpy.mock.calls[1][8]).toBe(true);
  });

  it('should fallback to target symbol when AI returns symbol mismatch', async () => {
    const openaiService = (service as any).openaiService;
    const featureService = (service as any).featureService;

    jest.spyOn(AllocationRecommendation, 'find').mockResolvedValue([]);
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

    jest.spyOn(AllocationRecommendation, 'find').mockResolvedValue([]);
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
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ]);

    expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ reason: '근거 문장 〖4:0†source〗' }));
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe('근거 문장');
  });

  it('should keep hold action as non-trading and carry forward target weight', async () => {
    const openaiService = (service as any).openaiService;
    const featureService = (service as any).featureService;

    jest.spyOn(AllocationRecommendation, 'find').mockResolvedValue([
      {
        modelTargetWeight: 0.27,
        intensity: 0,
      } as any,
    ]);
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
        symbol: 'BTC/KRW',
        category: Category.COIN_MAJOR,
        hasStock: true,
      },
    ]);

    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'hold',
        modelTargetWeight: 0.27,
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('hold');
    expect(result[0].modelTargetWeight).toBeCloseTo(0.27, 10);
  });

  it('should skip profit notify when no trades are executed in SQS message handling', async () => {
    const profitService = (service as any).profitService;
    const notifyService = (service as any).notifyService;

    jest.spyOn(service, 'executeAllocationForUser').mockResolvedValue([]);
    const sqsSendMock = jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);

    await (service as any).handleMessage({
      MessageId: 'message-1',
      ReceiptHandle: 'receipt-1',
      Body: JSON.stringify({
        version: 2,
        module: 'allocation',
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
      QueueUrl: process.env.AWS_SQS_QUEUE_URL_ALLOCATION,
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
    jest.spyOn(service, 'executeAllocationForUser').mockResolvedValue([]);
    jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);

    await (service as any).handleMessage({
      MessageId: 'message-legacy-module',
      ReceiptHandle: 'receipt-legacy-module',
      Body: JSON.stringify({
        version: 2,
        module: 'rebalance',
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
        module: 'allocation',
        messageKey: 'run-legacy:user-1',
        userId: 'user-1',
      }),
    );
  });

  it('should publish canonical allocation module label', async () => {
    const sqsSendMock = jest.spyOn((service as any).sqs, 'send').mockResolvedValue({} as any);

    await (service as any).publishAllocationMessage(
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
      'new',
    );

    expect(sqsSendMock).toHaveBeenCalledTimes(1);
    const messageBody = JSON.parse((sqsSendMock.mock.calls[0][0] as any).input.MessageBody);
    expect(messageBody.module).toBe('allocation');
    expect(messageBody.allocationMode).toBe('new');
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
        module: 'allocation',
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
      QueueUrl: process.env.AWS_SQS_QUEUE_URL_ALLOCATION,
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
        module: 'allocation',
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
      QueueUrl: process.env.AWS_SQS_QUEUE_URL_ALLOCATION,
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
          module: 'allocation',
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
    jest.spyOn(service, 'executeAllocationForUser').mockResolvedValue([]);
    jest.spyOn((service as any).sqs, 'send').mockRejectedValueOnce(new Error('delete failed'));

    await expect(
      (service as any).handleMessage({
        MessageId: 'message-delete-fail',
        ReceiptHandle: 'receipt-delete-fail',
        Body: JSON.stringify({
          version: 2,
          module: 'allocation',
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
