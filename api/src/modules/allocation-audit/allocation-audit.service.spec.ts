import { AllocationRecommendation } from '../allocation/entities/allocation-recommendation.entity';
import { MarketSignal } from '../market-intelligence/entities/market-signal.entity';
import { AllocationAuditService } from './allocation-audit.service';
import { AllocationAuditItem } from './entities/allocation-audit-item.entity';
import { AllocationAuditRun } from './entities/allocation-audit-run.entity';

describe('AllocationAuditService', () => {
  let service: AllocationAuditService;
  let openaiService: {
    addMessage: jest.Mock;
    createBatchRequest: jest.Mock;
    createBatch: jest.Mock;
    waitBatch: jest.Mock;
  };

  beforeEach(() => {
    const interpolate = (template: string, args: Record<string, unknown>) =>
      template.replace(/\{(\w+)\}/g, (_: string, key: string) => String(args[key] ?? ''));

    const templates: Record<string, string> = {
      'logging.allocationAudit.summary.no_valid_items': 'No valid items',
      'logging.allocationAudit.summary.accuracy': 'accuracy={ratio}% ({hit}/{total})',
      'logging.allocationAudit.summary.avg_return': 'avgReturn={value}',
      'logging.allocationAudit.summary.avg_overall': 'avgOverall={value}',
      'logging.allocationAudit.summary.low_score': 'lowScore={count}',
      'logging.allocationAudit.summary.guardrails': 'guardrails={value}',
      'logging.allocationAudit.summary.na': 'N/A',
      'logging.allocationAudit.summary.none': 'none',
    };

    openaiService = {
      addMessage: jest.fn(),
      createBatchRequest: jest.fn(),
      createBatch: jest.fn(),
      waitBatch: jest.fn(),
    };

    service = new AllocationAuditService(
      {
        t: jest.fn((key: string, options?: { args?: Record<string, unknown> }) => {
          const template = templates[key];
          if (!template) {
            return key;
          }
          return interpolate(template, options?.args ?? {});
        }),
      } as any,
      openaiService as any,
      {
        getMinuteCandleAt: jest.fn(),
        getMarketData: jest.fn(),
      } as any,
      {
        notifyServer: jest.fn(),
      } as any,
      {
        getErrorMessage: jest.fn((error: unknown) => String(error)),
      } as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should combine deterministic and ai score with 0.6/0.4 ratio', () => {
    const score = (service as any).calculateItemOverallScore({
      deterministicScore: 0.5,
      aiScore: 1,
    });

    expect(score).toBeCloseTo(0.7, 5);
  });

  it('should fallback to deterministic score when ai score is missing', () => {
    const score = (service as any).calculateItemOverallScore({
      deterministicScore: 0.42,
      aiScore: null,
    });

    expect(score).toBeCloseTo(0.42, 5);
  });

  it('should resolve allocation action from intensity when action is missing', () => {
    const buyAction = (service as any).resolveAllocationAction({
      recommendationAction: null,
      recommendationIntensity: 0.2,
    });
    const sellAction = (service as any).resolveAllocationAction({
      recommendationAction: null,
      recommendationIntensity: -0.1,
    });
    const holdAction = (service as any).resolveAllocationAction({
      recommendationAction: null,
      recommendationIntensity: 0,
    });

    expect(buyAction).toBe('buy');
    expect(sellAction).toBe('sell');
    expect(holdAction).toBe('hold');
  });

  it('should treat no_trade action as hold', () => {
    const action = (service as any).resolveAllocationAction({
      recommendationAction: 'no_trade',
      recommendationIntensity: 0.8,
    });

    expect(action).toBe('hold');
  });

  it('should extract confidence from allocation reason text', () => {
    const confidence = (service as any).extractConfidenceFromReason(
      '거래량 증가와 이벤트 모멘텀 반영, confidence=0.73, expectedVolatility=+/-2.4%',
    );

    expect(confidence).toBeCloseTo(0.73, 5);
  });

  it('should fallback to abs(intensity) when allocation reason has no confidence', () => {
    const confidence = (service as any).resolveAllocationRecommendationConfidence({
      reason: '거래량 증가 + 단기 추세 상향',
      intensity: -0.42,
    });

    expect(confidence).toBeCloseTo(0.42, 5);
  });

  it('should build summary with top guardrails from low score items', () => {
    const summary = (service as any).buildRunSummary([
      {
        aiVerdict: 'bad',
        deterministicScore: 0.1,
        aiScore: 0.2,
        directionHit: false,
        returnPct: -3.2,
        nextGuardrail: '외부 이벤트 확인 강화',
      },
      {
        aiVerdict: 'mixed',
        deterministicScore: 0.3,
        aiScore: 0.3,
        directionHit: false,
        returnPct: -1.1,
        nextGuardrail: '외부 이벤트 확인 강화',
      },
      {
        aiVerdict: 'good',
        deterministicScore: 0.8,
        aiScore: 0.9,
        directionHit: true,
        returnPct: 1.8,
        nextGuardrail: '거시 변수 모니터링',
      },
    ]);

    expect(summary).toContain('accuracy=');
    expect(summary).toContain('guardrails=외부 이벤트 확인 강화');
  });

  it('should paginate validation runs', async () => {
    const findAndCountSpy = jest.spyOn(AllocationAuditRun, 'findAndCount').mockResolvedValue([
      [
        {
          id: 'run-1',
          seq: 10,
          reportType: 'allocation',
          sourceBatchId: 'batch-1',
          horizonHours: 24,
          status: 'completed',
          itemCount: 20,
          completedCount: 20,
          deterministicScoreAvg: 0.6,
          aiScoreAvg: 0.5,
          overallScore: 0.56,
          summary: 'summary 〖4:0†source〗',
          startedAt: new Date(),
          completedAt: new Date(),
          error: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any,
      53,
    ]);

    const result = await service.getAuditRuns({ page: 2, perPage: 20, reportType: 'allocation' });

    expect(findAndCountSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        skip: 20,
        where: expect.objectContaining({ reportType: 'allocation' }),
      }),
    );
    expect(result.page).toBe(2);
    expect(result.perPage).toBe(20);
    expect(result.total).toBe(53);
    expect(result.totalPages).toBe(3);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.summary).toBe('summary');
  });

  it('should paginate validation run items', async () => {
    const findAndCountSpy = jest.spyOn(AllocationAuditItem, 'findAndCount').mockResolvedValue([
      [
        {
          id: 'item-1',
          seq: 1,
          run: { id: 'run-1' },
          reportType: 'allocation',
          sourceRecommendationId: 'rec-1',
          sourceBatchId: 'batch-1',
          symbol: 'BTC/KRW',
          horizonHours: 24,
          dueAt: new Date(),
          recommendationCreatedAt: new Date(),
          recommendationReason: 'reason 〖4:0†source〗',
          recommendationConfidence: 0.7,
          recommendationWeight: null,
          recommendationIntensity: 0.3,
          recommendationAction: 'buy',
          recommendationPrice: 100,
          evaluatedPrice: 102,
          returnPct: 2,
          directionHit: true,
          realizedTradePnl: 1000,
          realizedTradeAmount: 10000,
          tradeRoiPct: 10,
          deterministicScore: 0.8,
          aiVerdict: 'good',
          aiScore: 0.7,
          aiCalibration: 0.7,
          aiExplanation: 'ok[^1]',
          nextGuardrail: 'guardrail [출처: https://example.com]',
          status: 'completed',
          evaluatedAt: new Date(),
          error: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any,
      201,
    ]);

    const result = await service.getAuditRunItems('run-1', { page: 3, perPage: 50 });

    expect(findAndCountSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 100,
      }),
    );
    expect(result.page).toBe(3);
    expect(result.perPage).toBe(50);
    expect(result.total).toBe(201);
    expect(result.totalPages).toBe(5);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.recommendationReason).toBe('reason');
    expect(result.items[0]?.aiExplanation).toBe('ok');
    expect(result.items[0]?.nextGuardrail).toBe('guardrail');
  });

  it('should apply requested sort for validation runs', async () => {
    const findAndCountSpy = jest.spyOn(AllocationAuditRun, 'findAndCount').mockResolvedValue([[], 0] as any);

    await service.getAuditRuns({
      page: 1,
      perPage: 20,
      sortBy: 'overallScore',
      sortOrder: 'asc',
    });

    expect(findAndCountSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({
          overallScore: 'ASC',
        }),
      }),
    );
  });

  it('should apply requested sort for validation run items', async () => {
    const findAndCountSpy = jest.spyOn(AllocationAuditItem, 'findAndCount').mockResolvedValue([[], 0] as any);

    await service.getAuditRunItems('run-1', {
      page: 1,
      perPage: 50,
      sortBy: 'returnPct',
      sortOrder: 'asc',
    });

    expect(findAndCountSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({
          returnPct: 'ASC',
        }),
      }),
    );
  });

  it('should retry backfill after an initial failure', async () => {
    const enqueueMarketSpy = jest.spyOn(service as any, 'enqueueMarketBatchValidation').mockResolvedValue(undefined);
    const enqueueAllocationSpy = jest
      .spyOn(service as any, 'enqueueAllocationBatchValidation')
      .mockResolvedValue(undefined);

    jest
      .spyOn(MarketSignal, 'find')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([{ batchId: 'market-batch-1' }] as any);
    jest.spyOn(AllocationRecommendation, 'find').mockResolvedValue([{ batchId: 'allocation-batch-1' }] as any);

    await expect((service as any).ensureBackfillIfNeeded()).rejects.toThrow('boom');
    expect((service as any).lastBackfillCheckedAt).toBeNull();

    await expect((service as any).ensureBackfillIfNeeded()).resolves.toBeUndefined();
    expect(enqueueMarketSpy).toHaveBeenCalledWith('market-batch-1');
    expect(enqueueAllocationSpy).toHaveBeenCalledWith('allocation-batch-1');
    expect(typeof (service as any).lastBackfillCheckedAt).toBe('number');
  });

  it('should re-run backfill reconciliation after the recheck interval', async () => {
    jest.spyOn(MarketSignal, 'find').mockResolvedValue([] as any);
    jest.spyOn(AllocationRecommendation, 'find').mockResolvedValue([] as any);

    await expect((service as any).ensureBackfillIfNeeded()).resolves.toBeUndefined();
    await expect((service as any).ensureBackfillIfNeeded()).resolves.toBeUndefined();

    expect(MarketSignal.find).toHaveBeenCalledTimes(1);
    expect(AllocationRecommendation.find).toHaveBeenCalledTimes(1);

    (service as any).lastBackfillCheckedAt = Date.now() - (service as any).BACKFILL_RECHECK_INTERVAL_MS - 1;

    await expect((service as any).ensureBackfillIfNeeded()).resolves.toBeUndefined();

    expect(MarketSignal.find).toHaveBeenCalledTimes(2);
    expect(AllocationRecommendation.find).toHaveBeenCalledTimes(2);
  });

  it('should cache global allocation guardrails across symbol requests', async () => {
    const findSpy = jest.spyOn(AllocationAuditItem, 'find').mockImplementation(async (options: any) => {
      if (options?.where?.symbol) {
        return [
          {
            aiVerdict: 'good',
            directionHit: true,
            tradeRoiPct: 1.5,
          },
        ] as any;
      }

      return [
        {
          aiVerdict: 'bad',
          nextGuardrail: '거시 변수 모니터링 강화',
        },
      ] as any;
    });

    const first = await service.buildAllocationValidationGuardrailText('KRW-BTC');
    const second = await service.buildAllocationValidationGuardrailText('KRW-ETH');

    expect(first).toContain('전역 주요 가드레일');
    expect(second).toContain('전역 주요 가드레일');
    const globalCalls = findSpy.mock.calls.filter(([options]) => !(options as any)?.where?.symbol);
    expect(globalCalls).toHaveLength(1);
  });

  it('should mark item as running before ai evaluation', async () => {
    const run = {
      id: 'run-1',
      status: 'pending',
      startedAt: null,
      error: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const item = {
      id: 'item-1',
      reportType: 'market',
      recommendationPrice: null,
      recommendationCreatedAt: new Date(),
      symbol: 'KRW-BTC',
      dueAt: new Date(),
      aiVerdict: null,
      status: 'pending',
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(service as any, 'evaluateItemDeterministic').mockResolvedValue({
      evaluatedPrice: 101,
      recommendationPrice: 100,
      returnPct: 1,
      directionHit: true,
      deterministicScore: 0.8,
      realizedTradePnl: null,
      realizedTradeAmount: null,
      tradeRoiPct: null,
    });
    const applyAiEvaluationSpy = jest.spyOn(service as any, 'applyAiEvaluation').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'finalizeRun').mockResolvedValue(undefined);

    await (service as any).processRun(run, [item]);

    expect(item.status).toBe('running');
    expect(applyAiEvaluationSpy).toHaveBeenCalledWith([item]);
  });

  it('should mark unresolved price item as failed for retry', async () => {
    const run = {
      id: 'run-1',
      status: 'pending',
      startedAt: null,
      error: null,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const item = {
      id: 'item-1',
      reportType: 'market',
      recommendationPrice: null,
      recommendationCreatedAt: new Date(),
      symbol: 'KRW-BTC',
      dueAt: new Date(),
      aiVerdict: null,
      status: 'pending',
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(service as any, 'evaluateItemDeterministic').mockResolvedValue({
      evaluatedPrice: null,
      recommendationPrice: null,
      returnPct: null,
      directionHit: null,
      deterministicScore: null,
      realizedTradePnl: null,
      realizedTradeAmount: null,
      tradeRoiPct: null,
      invalidReason: 'Unable to resolve recommendation/evaluated price',
    });
    const applyAiEvaluationSpy = jest.spyOn(service as any, 'applyAiEvaluation').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'finalizeRun').mockResolvedValue(undefined);

    await (service as any).processRun(run, [item]);

    expect(item.status).toBe('failed');
    expect(item.aiVerdict).toBeNull();
    expect(applyAiEvaluationSpy).not.toHaveBeenCalled();
  });

  it('should wait batch with 24h timeout to avoid premature stale retry', async () => {
    const item = {
      id: 'item-1',
      reportType: 'market',
      symbol: 'KRW-BTC',
      horizonHours: 24,
      recommendationReason: 'reason',
      recommendationConfidence: 0.7,
      recommendationWeight: 0.4,
      recommendationIntensity: null,
      recommendationAction: 'buy',
      recommendationPrice: 100,
      recommendationCreatedAt: new Date(),
      evaluatedPrice: 101,
      returnPct: 1,
      directionHit: true,
      deterministicScore: 0.8,
      realizedTradePnl: null,
      realizedTradeAmount: null,
      tradeRoiPct: null,
      status: 'running',
      save: jest.fn().mockResolvedValue(undefined),
    };

    openaiService.createBatchRequest.mockReturnValue('{}');
    openaiService.createBatch.mockResolvedValue('batch-1');
    openaiService.waitBatch.mockResolvedValue([
      {
        custom_id: 'item-1',
        data: {
          verdict: 'good',
          score: 0.9,
          calibration: 0.8,
          explanation: 'ok',
          nextGuardrail: 'guardrail',
        },
      },
    ]);

    await (service as any).applyAiEvaluation([item]);

    expect(openaiService.waitBatch).toHaveBeenCalledWith('batch-1', 86_400_000, 30_000);
  });

  it('should prioritize pending/stale-running lookup before failed retries', async () => {
    const findSpy = jest.spyOn(AllocationAuditItem, 'find').mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await (service as any).processDueItems();

    expect(findSpy).toHaveBeenCalledTimes(2);
    const primaryOptions = findSpy.mock.calls[0]?.[0] as any;
    const failedRetryOptions = findSpy.mock.calls[1]?.[0] as any;

    expect(primaryOptions).toBeDefined();
    expect(Array.isArray(primaryOptions.where)).toBe(true);
    expect(primaryOptions.where).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'pending',
          dueAt: expect.any(Object),
        }),
        expect.objectContaining({
          status: 'running',
          dueAt: expect.any(Object),
          updatedAt: expect.any(Object),
        }),
      ]),
    );
    expect(primaryOptions.where).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'failed',
        }),
      ]),
    );

    expect(failedRetryOptions).toBeDefined();
    expect(failedRetryOptions.where).toEqual(
      expect.objectContaining({
        status: 'failed',
        dueAt: expect.any(Object),
        updatedAt: expect.any(Object),
      }),
    );
    expect(failedRetryOptions.order).toEqual({ updatedAt: 'ASC' });
  });

  it('should skip failed retry lookup when pending queue is full', async () => {
    (service as any).DUE_BATCH_LIMIT = 1;
    const run = { id: 'run-1' };
    const pendingItem = { id: 'item-1', run, status: 'pending' };
    const findSpy = jest.spyOn(AllocationAuditItem, 'find').mockResolvedValueOnce([pendingItem] as any);
    const processRunSpy = jest.spyOn(service as any, 'processRun').mockResolvedValue(undefined);

    await (service as any).processDueItems();

    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(processRunSpy).toHaveBeenCalledTimes(1);
  });

  it('should requeue running report validation items to pending and reset running runs', async () => {
    const item1 = {
      id: 'item-1',
      status: 'running',
      error: 'timeout',
      evaluatedAt: new Date(),
      run: { id: 'run-1' },
    };
    const item2 = {
      id: 'item-2',
      status: 'running',
      error: null,
      evaluatedAt: null,
      run: { id: 'run-2' },
    };
    const run1 = {
      id: 'run-1',
      status: 'running',
      startedAt: new Date(),
      completedAt: new Date(),
      error: 'partial failure',
    };
    const run2 = {
      id: 'run-2',
      status: 'running',
      startedAt: new Date(),
      completedAt: null,
      error: null,
    };

    jest.spyOn(AllocationAuditItem, 'find').mockResolvedValue([item1, item2] as any);
    const saveItemsSpy = jest.spyOn(AllocationAuditItem, 'save').mockResolvedValue(undefined as any);
    jest.spyOn(AllocationAuditRun, 'find').mockResolvedValue([run1, run2] as any);
    const saveRunsSpy = jest.spyOn(AllocationAuditRun, 'save').mockResolvedValue(undefined as any);

    const recoveredCount = await service.requeueRunningAuditsToPending();

    expect(recoveredCount).toBe(2);
    expect(item1.status).toBe('pending');
    expect(item1.error).toBeNull();
    expect(item1.evaluatedAt).toBeNull();
    expect(item2.status).toBe('pending');
    expect(run1.status).toBe('pending');
    expect(run1.startedAt).toBeNull();
    expect(run1.completedAt).toBeNull();
    expect(run1.error).toBeNull();
    expect(run2.status).toBe('pending');
    expect(saveItemsSpy).toHaveBeenCalledTimes(1);
    expect(saveRunsSpy).toHaveBeenCalledTimes(1);
  });

  it('should skip requeue when there are no running report validation items', async () => {
    const findItemsSpy = jest.spyOn(AllocationAuditItem, 'find').mockResolvedValue([]);
    const findRunsSpy = jest.spyOn(AllocationAuditRun, 'find');
    const saveItemsSpy = jest.spyOn(AllocationAuditItem, 'save');
    const saveRunsSpy = jest.spyOn(AllocationAuditRun, 'save');

    const recoveredCount = await service.requeueRunningAuditsToPending();

    expect(recoveredCount).toBe(0);
    expect(findItemsSpy).toHaveBeenCalledTimes(1);
    expect(findRunsSpy).not.toHaveBeenCalled();
    expect(saveItemsSpy).not.toHaveBeenCalled();
    expect(saveRunsSpy).not.toHaveBeenCalled();
  });

  it('should ignore stale in-flight confidence load after cache invalidation', async () => {
    let resolveFirstFind: ((items: any[]) => void) | null = null;
    const firstFindPromise = new Promise<any[]>((resolve) => {
      resolveFirstFind = resolve;
    });
    const findSpy = jest
      .spyOn(AllocationAuditItem, 'find')
      .mockImplementationOnce(() => firstFindPromise as any)
      .mockResolvedValueOnce([]);

    const firstCall = service.getRecommendedMarketMinConfidenceForAllocation();
    await Promise.resolve();

    (service as any).clearMarketMinConfidenceCache();

    const refreshed = await service.getRecommendedMarketMinConfidenceForAllocation();
    expect(refreshed).toBeCloseTo(0.45, 5);

    const staleSamples = [
      ...Array.from({ length: 20 }, () => ({
        aiVerdict: 'bad',
        directionHit: false,
        recommendationConfidence: 0.64,
        horizonHours: 24,
      })),
      ...Array.from({ length: 20 }, () => ({
        aiVerdict: 'good',
        directionHit: true,
        recommendationConfidence: 0.65,
        horizonHours: 24,
      })),
    ];
    resolveFirstFind?.(staleSamples as any[]);

    const staleResult = await firstCall;
    expect(staleResult).toBeCloseTo(0.65, 5);

    const finalValue = await service.getRecommendedMarketMinConfidenceForAllocation();
    expect(finalValue).toBeCloseTo(0.45, 5);
    expect(findSpy).toHaveBeenCalledTimes(2);
  });
});
