import { MarketRecommendation } from '../market-research/entities/market-recommendation.entity';
import { BalanceRecommendation } from '../rebalance/entities/balance-recommendation.entity';
import { ReportValidationItem } from './entities/report-validation-item.entity';
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
    expect((service as any).backfillChecked).toBe(false);

    await expect((service as any).ensureBackfillIfNeeded()).resolves.toBeUndefined();
    expect(enqueueMarketSpy).toHaveBeenCalledWith('market-batch-1');
    expect(enqueuePortfolioSpy).toHaveBeenCalledWith('portfolio-batch-1');
    expect((service as any).backfillChecked).toBe(true);
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

  it('should include failed and stale running items in due queue lookup', async () => {
    const findSpy = jest.spyOn(ReportValidationItem, 'find').mockResolvedValue([]);

    await (service as any).processDueItems();

    const options = findSpy.mock.calls[0]?.[0] as any;
    expect(options).toBeDefined();
    expect(Array.isArray(options.where)).toBe(true);
    expect(options.where).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'pending',
          dueAt: expect.any(Object),
        }),
        expect.objectContaining({
          status: 'failed',
          dueAt: expect.any(Object),
        }),
        expect.objectContaining({
          status: 'running',
          dueAt: expect.any(Object),
          updatedAt: expect.any(Object),
        }),
      ]),
    );
  });
});
