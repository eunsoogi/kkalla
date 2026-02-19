import { MarketRecommendation } from '../market-research/entities/market-recommendation.entity';
import { BalanceRecommendation } from '../rebalance/entities/balance-recommendation.entity';
import { ReportValidationItem } from './entities/report-validation-item.entity';
import { ReportValidationRun } from './entities/report-validation-run.entity';
import { ReportValidationService } from './report-validation.service';

describe('ReportValidationService', () => {
  let service: ReportValidationService;
  let openaiService: {
    addMessage: jest.Mock;
    createBatchRequest: jest.Mock;
    createBatch: jest.Mock;
    waitBatch: jest.Mock;
  };

  beforeEach(() => {
    openaiService = {
      addMessage: jest.fn(),
      createBatchRequest: jest.fn(),
      createBatch: jest.fn(),
      waitBatch: jest.fn(),
    };

    service = new ReportValidationService(
      {
        t: jest.fn((key: string) => key),
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

  it('should combine deterministic and gpt score with 0.6/0.4 ratio', () => {
    const score = (service as any).calculateItemOverallScore({
      deterministicScore: 0.5,
      gptScore: 1,
    });

    expect(score).toBeCloseTo(0.7, 5);
  });

  it('should fallback to deterministic score when gpt score is missing', () => {
    const score = (service as any).calculateItemOverallScore({
      deterministicScore: 0.42,
      gptScore: null,
    });

    expect(score).toBeCloseTo(0.42, 5);
  });

  it('should resolve portfolio action from intensity when action is missing', () => {
    const buyAction = (service as any).resolvePortfolioAction({
      recommendationAction: null,
      recommendationIntensity: 0.2,
    });
    const sellAction = (service as any).resolvePortfolioAction({
      recommendationAction: null,
      recommendationIntensity: -0.1,
    });
    const holdAction = (service as any).resolvePortfolioAction({
      recommendationAction: null,
      recommendationIntensity: 0,
    });

    expect(buyAction).toBe('buy');
    expect(sellAction).toBe('sell');
    expect(holdAction).toBe('hold');
  });

  it('should extract confidence from portfolio reason text', () => {
    const confidence = (service as any).extractConfidenceFromReason(
      '거래량 증가와 이벤트 모멘텀 반영, confidence=0.73, expectedVolatility=+/-2.4%',
    );

    expect(confidence).toBeCloseTo(0.73, 5);
  });

  it('should fallback to abs(intensity) when portfolio reason has no confidence', () => {
    const confidence = (service as any).resolvePortfolioRecommendationConfidence({
      reason: '거래량 증가 + 단기 추세 상향',
      intensity: -0.42,
    });

    expect(confidence).toBeCloseTo(0.42, 5);
  });

  it('should build summary with top guardrails from low score items', () => {
    const summary = (service as any).buildRunSummary([
      {
        gptVerdict: 'bad',
        deterministicScore: 0.1,
        gptScore: 0.2,
        directionHit: false,
        returnPct: -3.2,
        nextGuardrail: '외부 이벤트 확인 강화',
      },
      {
        gptVerdict: 'mixed',
        deterministicScore: 0.3,
        gptScore: 0.3,
        directionHit: false,
        returnPct: -1.1,
        nextGuardrail: '외부 이벤트 확인 강화',
      },
      {
        gptVerdict: 'good',
        deterministicScore: 0.8,
        gptScore: 0.9,
        directionHit: true,
        returnPct: 1.8,
        nextGuardrail: '거시 변수 모니터링',
      },
    ]);

    expect(summary).toContain('accuracy=');
    expect(summary).toContain('guardrails=외부 이벤트 확인 강화');
  });

  it('should paginate validation runs', async () => {
    const findAndCountSpy = jest.spyOn(ReportValidationRun, 'findAndCount').mockResolvedValue([
      [
        {
          id: 'run-1',
          seq: 10,
          reportType: 'portfolio',
          sourceBatchId: 'batch-1',
          horizonHours: 24,
          status: 'completed',
          itemCount: 20,
          completedCount: 20,
          deterministicScoreAvg: 0.6,
          gptScoreAvg: 0.5,
          overallScore: 0.56,
          summary: 'summary',
          startedAt: new Date(),
          completedAt: new Date(),
          error: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any,
      53,
    ]);

    const result = await service.getValidationRuns({ page: 2, perPage: 20, reportType: 'portfolio' });

    expect(findAndCountSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        skip: 20,
        where: expect.objectContaining({ reportType: 'portfolio' }),
      }),
    );
    expect(result.page).toBe(2);
    expect(result.perPage).toBe(20);
    expect(result.total).toBe(53);
    expect(result.totalPages).toBe(3);
    expect(result.items).toHaveLength(1);
  });

  it('should paginate validation run items', async () => {
    const findAndCountSpy = jest.spyOn(ReportValidationItem, 'findAndCount').mockResolvedValue([
      [
        {
          id: 'item-1',
          seq: 1,
          run: { id: 'run-1' },
          reportType: 'portfolio',
          sourceRecommendationId: 'rec-1',
          sourceBatchId: 'batch-1',
          symbol: 'BTC/KRW',
          horizonHours: 24,
          dueAt: new Date(),
          recommendationCreatedAt: new Date(),
          recommendationReason: 'reason',
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
          gptVerdict: 'good',
          gptScore: 0.7,
          gptCalibration: 0.7,
          gptExplanation: 'ok',
          nextGuardrail: 'guardrail',
          status: 'completed',
          evaluatedAt: new Date(),
          error: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any,
      201,
    ]);

    const result = await service.getValidationRunItems('run-1', { page: 3, perPage: 50 });

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
  });

  it('should retry backfill after an initial failure', async () => {
    const enqueueMarketSpy = jest.spyOn(service as any, 'enqueueMarketBatchValidation').mockResolvedValue(undefined);
    const enqueuePortfolioSpy = jest
      .spyOn(service as any, 'enqueuePortfolioBatchValidation')
      .mockResolvedValue(undefined);

    jest
      .spyOn(MarketRecommendation, 'find')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([{ batchId: 'market-batch-1' }] as any);
    jest.spyOn(BalanceRecommendation, 'find').mockResolvedValue([{ batchId: 'portfolio-batch-1' }] as any);

    await expect((service as any).ensureBackfillIfNeeded()).rejects.toThrow('boom');
    expect((service as any).lastBackfillCheckedAt).toBeNull();

    await expect((service as any).ensureBackfillIfNeeded()).resolves.toBeUndefined();
    expect(enqueueMarketSpy).toHaveBeenCalledWith('market-batch-1');
    expect(enqueuePortfolioSpy).toHaveBeenCalledWith('portfolio-batch-1');
    expect(typeof (service as any).lastBackfillCheckedAt).toBe('number');
  });

  it('should re-run backfill reconciliation after the recheck interval', async () => {
    jest.spyOn(MarketRecommendation, 'find').mockResolvedValue([] as any);
    jest.spyOn(BalanceRecommendation, 'find').mockResolvedValue([] as any);

    await expect((service as any).ensureBackfillIfNeeded()).resolves.toBeUndefined();
    await expect((service as any).ensureBackfillIfNeeded()).resolves.toBeUndefined();

    expect(MarketRecommendation.find).toHaveBeenCalledTimes(1);
    expect(BalanceRecommendation.find).toHaveBeenCalledTimes(1);

    (service as any).lastBackfillCheckedAt =
      Date.now() - (service as any).BACKFILL_RECHECK_INTERVAL_MS - 1;

    await expect((service as any).ensureBackfillIfNeeded()).resolves.toBeUndefined();

    expect(MarketRecommendation.find).toHaveBeenCalledTimes(2);
    expect(BalanceRecommendation.find).toHaveBeenCalledTimes(2);
  });

  it('should cache global portfolio guardrails across symbol requests', async () => {
    const findSpy = jest.spyOn(ReportValidationItem, 'find').mockImplementation(async (options: any) => {
      if (options?.where?.symbol) {
        return [
          {
            gptVerdict: 'good',
            directionHit: true,
            tradeRoiPct: 1.5,
          },
        ] as any;
      }

      return [
        {
          gptVerdict: 'bad',
          nextGuardrail: '거시 변수 모니터링 강화',
        },
      ] as any;
    });

    const first = await service.buildPortfolioValidationGuardrailText('KRW-BTC');
    const second = await service.buildPortfolioValidationGuardrailText('KRW-ETH');

    expect(first).toContain('전역 주요 가드레일');
    expect(second).toContain('전역 주요 가드레일');
    const globalCalls = findSpy.mock.calls.filter(([options]) => !(options as any)?.where?.symbol);
    expect(globalCalls).toHaveLength(1);
  });

  it('should mark item as running before gpt evaluation', async () => {
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
    const applyGptEvaluationSpy = jest.spyOn(service as any, 'applyGptEvaluation').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'finalizeRun').mockResolvedValue(undefined);

    await (service as any).processRun(run, [item]);

    expect(item.status).toBe('running');
    expect(applyGptEvaluationSpy).toHaveBeenCalledWith([item]);
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
    const applyGptEvaluationSpy = jest.spyOn(service as any, 'applyGptEvaluation').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'finalizeRun').mockResolvedValue(undefined);

    await (service as any).processRun(run, [item]);

    expect(item.status).toBe('failed');
    expect(item.gptVerdict).toBeNull();
    expect(applyGptEvaluationSpy).not.toHaveBeenCalled();
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

    await (service as any).applyGptEvaluation([item]);

    expect(openaiService.waitBatch).toHaveBeenCalledWith('batch-1', 86_400_000, 30_000);
  });

  it('should prioritize pending/stale-running lookup before failed retries', async () => {
    const findSpy = jest.spyOn(ReportValidationItem, 'find').mockResolvedValueOnce([]).mockResolvedValueOnce([]);

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
    const findSpy = jest.spyOn(ReportValidationItem, 'find').mockResolvedValueOnce([pendingItem] as any);
    const processRunSpy = jest.spyOn(service as any, 'processRun').mockResolvedValue(undefined);

    await (service as any).processDueItems();

    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(processRunSpy).toHaveBeenCalledTimes(1);
  });
});
