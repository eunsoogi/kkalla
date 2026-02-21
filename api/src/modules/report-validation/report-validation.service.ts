import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { I18nService } from 'nestjs-i18n';
import type { EasyInputMessage } from 'openai/resources/responses/responses';
import { In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';

import { ErrorService } from '@/modules/error/error.service';
import { MarketRecommendation } from '@/modules/market-research/entities/market-recommendation.entity';
import { NotifyService } from '@/modules/notify/notify.service';
import { OpenaiService } from '@/modules/openai/openai.service';
import { BalanceRecommendation } from '@/modules/rebalance/entities/balance-recommendation.entity';
import { WithRedlock } from '@/modules/redlock/decorators/redlock.decorator';
import { Trade } from '@/modules/trade/entities/trade.entity';
import { UpbitService } from '@/modules/upbit/upbit.service';

import { ReportValidationItem } from './entities/report-validation-item.entity';
import { ReportValidationRun } from './entities/report-validation-run.entity';
import {
  REPORT_VALIDATION_EVALUATOR_CONFIG,
  REPORT_VALIDATION_EVALUATOR_PROMPT,
  REPORT_VALIDATION_EVALUATOR_RESPONSE_SCHEMA,
} from './prompts/report-validation.prompt';
import { REPORT_VALIDATION_EXECUTE_DUE_VALIDATIONS_LOCK, ScheduleExpression } from './report-validation.enum';
import {
  MarketValidationBadges,
  PortfolioValidationBadges,
  ReportType,
  ReportValidationBadge,
  ReportValidationItemSortBy,
  ReportValidationRunItemPage,
  ReportValidationRunItemSummary,
  ReportValidationRunPage,
  ReportValidationRunSortBy,
  ReportValidationRunSummary,
  ReportValidationSortOrder,
  ReportValidationStatus,
  ReportValidationVerdict,
} from './report-validation.interface';

interface DeterministicEvaluation {
  evaluatedPrice: number | null;
  recommendationPrice: number | null;
  returnPct: number | null;
  directionHit: boolean | null;
  deterministicScore: number | null;
  realizedTradePnl: number | null;
  realizedTradeAmount: number | null;
  tradeRoiPct: number | null;
  invalidReason?: string;
}

interface ConfidenceCalibrationSample {
  confidence: number;
  directionHit: boolean;
  horizonHours: number;
}

@Injectable()
export class ReportValidationService {
  private readonly logger = new Logger(ReportValidationService.name);

  private readonly MARKET_HORIZONS = [24, 72] as const;
  private readonly PORTFOLIO_HORIZONS = [24, 72] as const;
  private readonly BACKFILL_LOOKBACK_DAYS = 7;
  private readonly BACKFILL_RECHECK_INTERVAL_MS = 60 * 60 * 1000;
  private readonly VALIDATION_SUMMARY_LOOKBACK_DAYS = 30;
  private readonly PORTFOLIO_GLOBAL_GUARDRAIL_CACHE_TTL_MS = 5 * 60 * 1000;
  private readonly RETENTION_DAYS = 180;
  private readonly DUE_BATCH_LIMIT = 300;
  private readonly LOW_SCORE_THRESHOLD = 0.5;
  private readonly OPENAI_BATCH_MAX_WAIT_MS = 24 * 60 * 60 * 1000;
  private readonly OPENAI_BATCH_POLL_INTERVAL_MS = 30 * 1000;
  private readonly RUNNING_STALE_TIMEOUT_MS = this.OPENAI_BATCH_MAX_WAIT_MS + 5 * 60 * 1000;
  private readonly FAILED_RETRY_INTERVAL_MS = 30 * 60 * 1000;
  private readonly MARKET_MIN_CONFIDENCE_CACHE_TTL_MS = 10 * 60 * 1000;
  private readonly PORTFOLIO_MARKET_MIN_CONFIDENCE_DEFAULT = 0.45;
  private readonly PORTFOLIO_MARKET_MIN_CONFIDENCE_MIN = 0.45;
  private readonly PORTFOLIO_MARKET_MIN_CONFIDENCE_MAX = 0.65;
  private readonly PORTFOLIO_MARKET_MIN_CONFIDENCE_STEP = 0.01;
  private readonly PORTFOLIO_MARKET_MIN_CONFIDENCE_MIN_TOTAL_SAMPLES = 40;
  private readonly PORTFOLIO_MARKET_MIN_CONFIDENCE_MIN_BUCKET_SAMPLES = 20;
  private readonly PORTFOLIO_MARKET_MIN_CONFIDENCE_MIN_COVERAGE = 0.15;
  private readonly PORTFOLIO_MARKET_MIN_CONFIDENCE_TARGET_HIT_RATE = 0.55;
  private readonly PORTFOLIO_MARKET_MIN_CONFIDENCE_TARGET_LIFT = 0.03;
  private lastBackfillCheckedAt: number | null = null;
  private portfolioGlobalGuardrailsCache: { expiresAt: number; guardrails: string[] } | null = null;
  private portfolioGlobalGuardrailsInFlight: Promise<string[]> | null = null;
  private marketMinConfidenceCache: { expiresAt: number; value: number } | null = null;
  private marketMinConfidenceInFlight: Promise<number> | null = null;
  private marketMinConfidenceCacheGeneration = 0;

  constructor(
    private readonly i18n: I18nService,
    private readonly openaiService: OpenaiService,
    private readonly upbitService: UpbitService,
    private readonly notifyService: NotifyService,
    private readonly errorService: ErrorService,
  ) {}

  @Cron(ScheduleExpression.HOURLY_REPORT_VALIDATION)
  @WithRedlock({ duration: REPORT_VALIDATION_EXECUTE_DUE_VALIDATIONS_LOCK.duration })
  public async executeDueValidations(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    await this.executeDueValidationsTask();
  }

  @Cron(ScheduleExpression.DAILY_REPORT_VALIDATION_RETENTION)
  public async cleanupOldValidations(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    await this.cleanupOldValidationsTask();
  }

  public async executeDueValidationsTask(): Promise<void> {
    try {
      await this.ensureBackfillIfNeeded();
      await this.processDueItems();
    } catch (error) {
      this.logger.error(this.i18n.t('logging.reportValidation.task.execute_failed'), error);
      await this.safeNotifyServer(
        this.i18n.t('notify.reportValidation.task_failed', {
          args: {
            message: this.errorService.getErrorMessage(error),
          },
        }),
      );
      throw error;
    }
  }

  public async requeueRunningValidationsToPending(): Promise<number> {
    const runningItems = await ReportValidationItem.find({
      where: {
        status: 'running',
      } as any,
      relations: {
        run: true,
      },
    });

    if (runningItems.length < 1) {
      return 0;
    }

    for (const item of runningItems) {
      item.status = 'pending';
      item.error = null;
      item.evaluatedAt = null;
    }
    await ReportValidationItem.save(runningItems, { chunk: 100 });

    const runIds = Array.from(
      new Set(runningItems.map((item) => item.run?.id).filter((runId): runId is string => !!runId)),
    );

    if (runIds.length > 0) {
      const runningRuns = await ReportValidationRun.find({
        where: {
          id: In(runIds),
          status: 'running',
        } as any,
      });

      for (const run of runningRuns) {
        run.status = 'pending';
        run.startedAt = null;
        run.completedAt = null;
        run.error = null;
      }

      if (runningRuns.length > 0) {
        await ReportValidationRun.save(runningRuns, { chunk: 100 });
      }
    }

    return runningItems.length;
  }

  public async cleanupOldValidationsTask(): Promise<void> {
    const threshold = new Date(Date.now() - this.RETENTION_DAYS * 24 * 60 * 60 * 1000);

    try {
      await ReportValidationItem.createQueryBuilder()
        .delete()
        .where('created_at < :threshold', { threshold })
        .andWhere('status IN (:...statuses)', { statuses: ['completed', 'failed'] })
        .execute();

      await ReportValidationRun.createQueryBuilder()
        .delete()
        .where('created_at < :threshold', { threshold })
        .andWhere('status IN (:...statuses)', { statuses: ['completed', 'failed'] })
        .execute();

      this.clearMarketMinConfidenceCache();
      this.clearPortfolioGlobalGuardrailsCache();
    } catch (error) {
      this.logger.error(this.i18n.t('logging.reportValidation.task.cleanup_failed'), error);
      await this.safeNotifyServer(
        this.i18n.t('notify.reportValidation.cleanup_failed', {
          args: {
            message: this.errorService.getErrorMessage(error),
          },
        }),
      );
      throw error;
    }
  }

  public async enqueueMarketBatchValidation(batchId: string): Promise<void> {
    await this.enqueueBatchValidation('market', batchId);
  }

  public async enqueuePortfolioBatchValidation(batchId: string): Promise<void> {
    await this.enqueueBatchValidation('portfolio', batchId);
  }

  public async getRecommendedMarketMinConfidenceForPortfolio(): Promise<number> {
    const now = Date.now();
    if (this.marketMinConfidenceCache && this.marketMinConfidenceCache.expiresAt > now) {
      return this.marketMinConfidenceCache.value;
    }
    if (this.marketMinConfidenceInFlight) {
      return this.marketMinConfidenceInFlight;
    }

    const generation = this.marketMinConfidenceCacheGeneration;
    const loadPromise = (async () => {
      const since = new Date(Date.now() - this.VALIDATION_SUMMARY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
      const items = await ReportValidationItem.find({
        where: {
          reportType: 'market',
          status: 'completed',
          createdAt: MoreThanOrEqual(since),
        } as any,
        order: {
          createdAt: 'DESC',
        },
        take: 2000,
      });

      const tuned = this.resolveMarketMinConfidenceFromValidation(items);
      const value = this.clamp(
        tuned ?? this.PORTFOLIO_MARKET_MIN_CONFIDENCE_DEFAULT,
        this.PORTFOLIO_MARKET_MIN_CONFIDENCE_MIN,
        this.PORTFOLIO_MARKET_MIN_CONFIDENCE_MAX,
      );

      // Ignore stale async results once cache was invalidated and generation moved on.
      if (this.marketMinConfidenceCacheGeneration === generation) {
        this.marketMinConfidenceCache = {
          value,
          expiresAt: Date.now() + this.MARKET_MIN_CONFIDENCE_CACHE_TTL_MS,
        };
      }

      return value;
    })();

    this.marketMinConfidenceInFlight = loadPromise;
    try {
      return await loadPromise;
    } finally {
      if (this.marketMinConfidenceInFlight === loadPromise) {
        this.marketMinConfidenceInFlight = null;
      }
    }
  }

  public async buildMarketValidationGuardrailText(): Promise<string | null> {
    const since = new Date(Date.now() - this.VALIDATION_SUMMARY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const items = await ReportValidationItem.find({
      where: {
        reportType: 'market',
        status: 'completed',
        createdAt: MoreThanOrEqual(since),
      } as any,
      order: {
        createdAt: 'DESC',
      },
      take: 1500,
    });

    const evaluatedItems = items.filter((item) => item.aiVerdict !== 'invalid');
    if (evaluatedItems.length < 1) {
      return null;
    }

    const items24h = evaluatedItems.filter((item) => item.horizonHours === 24);
    const items72h = evaluatedItems.filter((item) => item.horizonHours === 72);

    const accuracy24h = this.calculateAccuracy(items24h);
    const accuracy72h = this.calculateAccuracy(items72h);
    const highConfidenceItems = evaluatedItems.filter(
      (item) => this.isFiniteNumber(item.recommendationConfidence) && Number(item.recommendationConfidence) >= 0.7,
    );
    const highConfidenceMiss = highConfidenceItems.filter((item) => item.directionHit === false).length;
    const highConfidenceMissRate =
      highConfidenceItems.length > 0 ? (highConfidenceMiss / highConfidenceItems.length) * 100 : 0;
    const topGuardrails = this.extractTopGuardrails(evaluatedItems, 5);

    return [
      `최근 ${this.VALIDATION_SUMMARY_LOOKBACK_DAYS}일 마켓 리포트 사후검증 요약`,
      `24h 정확도: ${accuracy24h.ratio.toFixed(2)}% (${accuracy24h.hit}/${accuracy24h.total})`,
      `72h 정확도: ${accuracy72h.ratio.toFixed(2)}% (${accuracy72h.hit}/${accuracy72h.total})`,
      `고신뢰(>=70%) 오판율: ${highConfidenceMissRate.toFixed(2)}% (${highConfidenceMiss}/${highConfidenceItems.length})`,
      `주요 가드레일: ${topGuardrails.length > 0 ? topGuardrails.join(' | ') : '없음'}`,
    ].join('\n');
  }

  public async buildPortfolioValidationGuardrailText(symbol: string): Promise<string | null> {
    const since = new Date(Date.now() - this.VALIDATION_SUMMARY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const symbolItems = await ReportValidationItem.find({
      where: {
        reportType: 'portfolio',
        status: 'completed',
        symbol,
        createdAt: MoreThanOrEqual(since),
      } as any,
      order: {
        createdAt: 'DESC',
      },
      take: 800,
    });

    const evaluatedSymbolItems = symbolItems.filter((item) => item.aiVerdict !== 'invalid');
    if (evaluatedSymbolItems.length < 1) {
      return null;
    }

    const items24h = evaluatedSymbolItems.filter((item) => item.horizonHours === 24);
    const items72h = evaluatedSymbolItems.filter((item) => item.horizonHours === 72);
    const accuracy24h = this.calculateAccuracy(items24h);
    const accuracy72h = this.calculateAccuracy(items72h);
    const avgTradeRoi = this.average(
      evaluatedSymbolItems
        .map((item) => (this.isFiniteNumber(item.tradeRoiPct) ? Number(item.tradeRoiPct) : null))
        .filter((value): value is number => value != null),
    );
    const topGlobalGuardrails = await this.getPortfolioGlobalGuardrails();

    return [
      `최근 ${this.VALIDATION_SUMMARY_LOOKBACK_DAYS}일 포트폴리오 사후검증 요약 (${symbol})`,
      `24h 방향 정확도: ${accuracy24h.ratio.toFixed(2)}% (${accuracy24h.hit}/${accuracy24h.total})`,
      `72h 방향 정확도: ${accuracy72h.ratio.toFixed(2)}% (${accuracy72h.hit}/${accuracy72h.total})`,
      `평균 Trade ROI: ${avgTradeRoi != null ? `${avgTradeRoi.toFixed(2)}%` : 'N/A'}`,
      `전역 주요 가드레일: ${topGlobalGuardrails.length > 0 ? topGlobalGuardrails.join(' | ') : '없음'}`,
    ].join('\n');
  }

  public async getMarketValidationBadgeMap(recommendationIds: string[]): Promise<Map<string, MarketValidationBadges>> {
    const ids = Array.from(new Set(recommendationIds.filter((id) => !!id)));
    const map = new Map<string, MarketValidationBadges>();
    if (ids.length < 1) {
      return map;
    }

    const items = await ReportValidationItem.find({
      where: {
        sourceRecommendationId: In(ids),
        reportType: 'market',
        horizonHours: In([...this.MARKET_HORIZONS]),
      } as any,
    });

    for (const item of items) {
      const existing = map.get(item.sourceRecommendationId) ?? {};
      const badge = this.buildBadge(item);
      if (item.horizonHours === 24) {
        existing.validation24h = badge;
      } else if (item.horizonHours === 72) {
        existing.validation72h = badge;
      }
      map.set(item.sourceRecommendationId, existing);
    }

    return map;
  }

  public async getPortfolioValidationBadgeMap(
    recommendationIds: string[],
  ): Promise<Map<string, PortfolioValidationBadges>> {
    const ids = Array.from(new Set(recommendationIds.filter((id) => !!id)));
    const map = new Map<string, PortfolioValidationBadges>();
    if (ids.length < 1) {
      return map;
    }

    const items = await ReportValidationItem.find({
      where: {
        sourceRecommendationId: In(ids),
        reportType: 'portfolio',
        horizonHours: In([...this.PORTFOLIO_HORIZONS]),
      } as any,
    });

    for (const item of items) {
      const existing = map.get(item.sourceRecommendationId) ?? {};
      const badge = this.buildBadge(item);
      if (item.horizonHours === 24) {
        existing.validation24h = badge;
      } else if (item.horizonHours === 72) {
        existing.validation72h = badge;
      }
      map.set(item.sourceRecommendationId, existing);
    }

    return map;
  }

  public async getValidationRuns(params?: {
    limit?: number;
    page?: number;
    perPage?: number;
    includeSummary?: boolean;
    sortBy?: ReportValidationRunSortBy;
    sortOrder?: ReportValidationSortOrder;
    reportType?: ReportType;
    status?: ReportValidationStatus;
  }): Promise<ReportValidationRunPage> {
    const safePage = this.clampLimit(params?.page, 1, 1, 1000000);
    const safePerPage = this.clampLimit(params?.perPage ?? params?.limit, 30, 1, 200);
    const sortBy = this.resolveRunSortBy(params?.sortBy);
    const sortOrder = this.resolveSortOrder(params?.sortOrder);
    const where: Record<string, unknown> = {};

    if (params?.reportType) {
      where.reportType = params.reportType;
    }

    if (params?.status) {
      where.status = params.status;
    }

    const [runs, total] = await ReportValidationRun.findAndCount({
      where: where as any,
      order: this.buildRunOrder(sortBy, sortOrder),
      take: safePerPage,
      skip: (safePage - 1) * safePerPage,
    });

    const response: ReportValidationRunPage = {
      items: runs.map((run) => ({
        id: run.id,
        seq: run.seq,
        reportType: run.reportType,
        sourceBatchId: run.sourceBatchId,
        horizonHours: run.horizonHours,
        status: run.status,
        itemCount: run.itemCount,
        completedCount: run.completedCount,
        deterministicScoreAvg: run.deterministicScoreAvg,
        aiScoreAvg: run.aiScoreAvg,
        overallScore: run.overallScore,
        summary: run.summary,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        error: run.error,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      })),
      total,
      page: safePage,
      perPage: safePerPage,
      totalPages: Math.ceil(total / safePerPage),
    };

    if (params?.includeSummary) {
      response.summary = await this.getValidationRunsSummary({
        totalRuns: total,
        reportType: params?.reportType,
        status: params?.status,
      });
    }

    return response;
  }

  public async getValidationRunItems(
    runId: string,
    params?: {
      limit?: number;
      page?: number;
      perPage?: number;
      includeSummary?: boolean;
      sortBy?: ReportValidationItemSortBy;
      sortOrder?: ReportValidationSortOrder;
    },
  ): Promise<ReportValidationRunItemPage> {
    const safePage = this.clampLimit(params?.page, 1, 1, 1000000);
    const safePerPage = this.clampLimit(params?.perPage ?? params?.limit, 200, 1, 1000);
    const sortBy = this.resolveItemSortBy(params?.sortBy);
    const sortOrder = this.resolveSortOrder(params?.sortOrder);
    const [items, total] = await ReportValidationItem.findAndCount({
      where: {
        run: {
          id: runId,
        },
      } as any,
      order: this.buildItemOrder(sortBy, sortOrder),
      take: safePerPage,
      skip: (safePage - 1) * safePerPage,
      relations: {
        run: true,
      },
    });

    const response: ReportValidationRunItemPage = {
      items: items.map((item) => ({
        id: item.id,
        seq: item.seq,
        runId: item.run.id,
        reportType: item.reportType,
        sourceRecommendationId: item.sourceRecommendationId,
        sourceBatchId: item.sourceBatchId,
        symbol: item.symbol,
        horizonHours: item.horizonHours,
        dueAt: item.dueAt,
        recommendationCreatedAt: item.recommendationCreatedAt,
        recommendationReason: item.recommendationReason,
        recommendationConfidence: item.recommendationConfidence,
        recommendationWeight: item.recommendationWeight,
        recommendationIntensity: item.recommendationIntensity,
        recommendationAction: item.recommendationAction,
        recommendationPrice: item.recommendationPrice,
        evaluatedPrice: item.evaluatedPrice,
        returnPct: item.returnPct,
        directionHit: item.directionHit,
        realizedTradePnl: item.realizedTradePnl,
        realizedTradeAmount: item.realizedTradeAmount,
        tradeRoiPct: item.tradeRoiPct,
        deterministicScore: item.deterministicScore,
        aiVerdict: item.aiVerdict,
        aiScore: item.aiScore,
        aiCalibration: item.aiCalibration,
        aiExplanation: item.aiExplanation,
        nextGuardrail: item.nextGuardrail,
        status: item.status,
        evaluatedAt: item.evaluatedAt,
        error: item.error,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      total,
      page: safePage,
      perPage: safePerPage,
      totalPages: Math.ceil(total / safePerPage),
    };

    if (params?.includeSummary) {
      response.summary = await this.getValidationRunItemsSummary(runId, total);
    }

    return response;
  }

  private async getValidationRunsSummary(params: {
    totalRuns: number;
    reportType?: ReportType;
    status?: ReportValidationStatus;
  }): Promise<ReportValidationRunSummary> {
    const summaryQuery = ReportValidationRun.createQueryBuilder('run')
      .select(`SUM(CASE WHEN run.status IN ('pending', 'running') THEN 1 ELSE 0 END)`, 'pendingOrRunning')
      .addSelect(`SUM(CASE WHEN run.status = 'completed' THEN 1 ELSE 0 END)`, 'completed')
      .addSelect('AVG(run.overall_score)', 'avgScore');

    if (params.reportType) {
      summaryQuery.andWhere('run.report_type = :reportType', {
        reportType: params.reportType,
      });
    }

    if (params.status) {
      summaryQuery.andWhere('run.status = :status', {
        status: params.status,
      });
    }

    const raw = await summaryQuery.getRawOne<{
      pendingOrRunning?: string | number | null;
      completed?: string | number | null;
      avgScore?: string | number | null;
    }>();

    let recommendedMarketMinConfidenceForPortfolio: number | null = null;
    try {
      recommendedMarketMinConfidenceForPortfolio = await this.getRecommendedMarketMinConfidenceForPortfolio();
    } catch (error) {
      this.logger.warn('Failed to load recommended market minimum confidence for summary', error);
    }

    return {
      totalRuns: this.toNonNegativeInteger(params.totalRuns),
      pendingOrRunning: this.toNonNegativeInteger(raw?.pendingOrRunning),
      completed: this.toNonNegativeInteger(raw?.completed),
      avgScore: this.toNullableNumber(raw?.avgScore),
      recommendedMarketMinConfidenceForPortfolio,
    };
  }

  private async getValidationRunItemsSummary(
    runId: string,
    totalItems: number,
  ): Promise<ReportValidationRunItemSummary> {
    const nonInvalidCondition = `(item.ai_verdict IS NULL OR item.ai_verdict <> 'invalid')`;
    const overallScoreExpression = `
      CASE
        WHEN item.deterministic_score IS NOT NULL AND item.ai_score IS NOT NULL
          THEN LEAST(GREATEST((0.6 * item.deterministic_score) + (0.4 * item.ai_score), 0), 1)
        WHEN item.deterministic_score IS NOT NULL
          THEN LEAST(GREATEST(item.deterministic_score, 0), 1)
        WHEN item.ai_score IS NOT NULL
          THEN LEAST(GREATEST(item.ai_score, 0), 1)
        ELSE NULL
      END
    `;

    const summaryQuery = ReportValidationItem.createQueryBuilder('item')
      .select(`SUM(CASE WHEN item.ai_verdict = 'invalid' THEN 1 ELSE 0 END)`, 'invalidCount')
      .addSelect(`SUM(CASE WHEN item.ai_verdict = 'good' THEN 1 ELSE 0 END)`, 'verdictGood')
      .addSelect(`SUM(CASE WHEN item.ai_verdict = 'mixed' THEN 1 ELSE 0 END)`, 'verdictMixed')
      .addSelect(`SUM(CASE WHEN item.ai_verdict = 'bad' THEN 1 ELSE 0 END)`, 'verdictBad')
      .addSelect(`AVG(CASE WHEN ${nonInvalidCondition} THEN ${overallScoreExpression} ELSE NULL END)`, 'avgItemScore')
      .addSelect(`AVG(CASE WHEN ${nonInvalidCondition} THEN item.return_pct ELSE NULL END)`, 'avgReturn')
      .where('item.run_id = :runId', { runId });

    const raw = await summaryQuery.getRawOne<{
      invalidCount?: string | number | null;
      verdictGood?: string | number | null;
      verdictMixed?: string | number | null;
      verdictBad?: string | number | null;
      avgItemScore?: string | number | null;
      avgReturn?: string | number | null;
    }>();

    return {
      itemCount: this.toNonNegativeInteger(totalItems),
      invalidCount: this.toNonNegativeInteger(raw?.invalidCount),
      avgItemScore: this.toNullableNumber(raw?.avgItemScore),
      avgReturn: this.toNullableNumber(raw?.avgReturn),
      verdictGood: this.toNonNegativeInteger(raw?.verdictGood),
      verdictMixed: this.toNonNegativeInteger(raw?.verdictMixed),
      verdictBad: this.toNonNegativeInteger(raw?.verdictBad),
    };
  }

  private resolveRunSortBy(value: ReportValidationRunSortBy | undefined): ReportValidationRunSortBy {
    if (
      value === 'createdAt' ||
      value === 'completedAt' ||
      value === 'overallScore' ||
      value === 'status' ||
      value === 'seq'
    ) {
      return value;
    }
    return 'createdAt';
  }

  private resolveItemSortBy(value: ReportValidationItemSortBy | undefined): ReportValidationItemSortBy {
    if (
      value === 'createdAt' ||
      value === 'evaluatedAt' ||
      value === 'returnPct' ||
      value === 'deterministicScore' ||
      value === 'aiScore' ||
      value === 'symbol' ||
      value === 'status' ||
      value === 'aiVerdict'
    ) {
      return value;
    }
    return 'createdAt';
  }

  private resolveSortOrder(value: ReportValidationSortOrder | undefined): 'ASC' | 'DESC' {
    return value === 'asc' ? 'ASC' : 'DESC';
  }

  private buildRunOrder(sortBy: ReportValidationRunSortBy, sortOrder: 'ASC' | 'DESC'): Record<string, 'ASC' | 'DESC'> {
    const order: Record<string, 'ASC' | 'DESC'> = {};
    order[sortBy] = sortOrder;
    if (sortBy !== 'createdAt') {
      order.createdAt = 'DESC';
    }
    if (sortBy !== 'seq') {
      order.seq = 'DESC';
    }
    return order;
  }

  private buildItemOrder(
    sortBy: ReportValidationItemSortBy,
    sortOrder: 'ASC' | 'DESC',
  ): Record<string, 'ASC' | 'DESC'> {
    const order: Record<string, 'ASC' | 'DESC'> = {};
    order[sortBy] = sortOrder;
    if (sortBy !== 'createdAt') {
      order.createdAt = 'DESC';
    }
    if (sortBy !== 'seq') {
      order.seq = 'DESC';
    }
    return order;
  }

  private buildBadge(item: ReportValidationItem): ReportValidationBadge {
    return {
      status: item.status,
      overallScore: this.calculateItemOverallScore(item),
      verdict: item.aiVerdict,
      evaluatedAt: item.evaluatedAt,
    };
  }

  private async ensureBackfillIfNeeded(): Promise<void> {
    const now = Date.now();
    if (this.lastBackfillCheckedAt != null && now - this.lastBackfillCheckedAt < this.BACKFILL_RECHECK_INTERVAL_MS) {
      return;
    }

    const since = new Date(Date.now() - this.BACKFILL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const [marketRecommendations, balanceRecommendations] = await Promise.all([
      MarketRecommendation.find({
        where: {
          createdAt: MoreThanOrEqual(since),
        } as any,
      }),
      BalanceRecommendation.find({
        where: {
          createdAt: MoreThanOrEqual(since),
        } as any,
      }),
    ]);

    const marketBatchIds = Array.from(new Set(marketRecommendations.map((item) => item.batchId)));
    const balanceBatchIds = Array.from(new Set(balanceRecommendations.map((item) => item.batchId)));

    for (const batchId of marketBatchIds) {
      await this.enqueueMarketBatchValidation(batchId);
    }

    for (const batchId of balanceBatchIds) {
      await this.enqueuePortfolioBatchValidation(batchId);
    }

    this.lastBackfillCheckedAt = Date.now();
  }

  private async enqueueBatchValidation(reportType: ReportType, batchId: string): Promise<void> {
    const horizons = reportType === 'market' ? [...this.MARKET_HORIZONS] : [...this.PORTFOLIO_HORIZONS];
    const recommendations =
      reportType === 'market'
        ? await MarketRecommendation.find({ where: { batchId } })
        : await BalanceRecommendation.find({ where: { batchId } });

    if (recommendations.length < 1) {
      return;
    }

    for (const horizonHours of horizons) {
      const run = await this.findOrCreateRun(reportType, batchId, horizonHours);
      const recommendationIds = recommendations.map((item) => item.id);
      const existing = await ReportValidationItem.find({
        where: {
          sourceRecommendationId: In(recommendationIds),
          horizonHours,
        } as any,
        select: ['sourceRecommendationId'],
      });
      const existingIdSet = new Set(existing.map((item) => item.sourceRecommendationId));

      const itemsToCreate = await Promise.all(
        recommendations
          .filter((item) => !existingIdSet.has(item.id))
          .map(async (item) => {
            const entity = new ReportValidationItem();
            const recommendationCreatedAt = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
            const recommendationPrice = await this.resolvePriceAtTime(item.symbol, recommendationCreatedAt);

            entity.run = run;
            entity.reportType = reportType;
            entity.sourceRecommendationId = item.id;
            entity.sourceBatchId = batchId;
            entity.symbol = item.symbol;
            entity.horizonHours = horizonHours;
            entity.dueAt = new Date(recommendationCreatedAt.getTime() + horizonHours * 60 * 60 * 1000);
            entity.recommendationCreatedAt = recommendationCreatedAt;
            entity.recommendationPrice = recommendationPrice ?? null;
            entity.status = 'pending';
            entity.error = null;

            if (reportType === 'market') {
              const recommendation = item as MarketRecommendation;
              entity.recommendationReason = recommendation.reason;
              entity.recommendationConfidence = this.toNullableNumber(recommendation.confidence);
              entity.recommendationWeight = this.toNullableNumber(recommendation.weight);
              entity.recommendationIntensity = null;
              entity.recommendationAction = 'buy';
            } else {
              const recommendation = item as BalanceRecommendation;
              entity.recommendationReason = recommendation.reason;
              entity.recommendationConfidence = this.resolvePortfolioRecommendationConfidence(recommendation);
              entity.recommendationWeight = null;
              entity.recommendationIntensity = this.toNullableNumber(recommendation.intensity);
              entity.recommendationAction = recommendation.action ?? null;
            }

            return entity;
          }),
      );

      if (itemsToCreate.length > 0) {
        try {
          await ReportValidationItem.save(itemsToCreate, { chunk: 100 });
        } catch (error) {
          this.logger.warn(
            this.i18n.t('logging.reportValidation.task.insert_partial_failed', {
              args: {
                reportType,
                batchId,
                horizonHours,
              },
            }),
            error,
          );
        }
      }

      run.itemCount = await ReportValidationItem.count({
        where: {
          run: {
            id: run.id,
          },
        } as any,
      });
      await run.save();
    }
  }

  private async findOrCreateRun(
    reportType: ReportType,
    sourceBatchId: string,
    horizonHours: number,
  ): Promise<ReportValidationRun> {
    const existing = await ReportValidationRun.findOne({
      where: { reportType, sourceBatchId, horizonHours },
    });
    if (existing) {
      return existing;
    }

    const run = new ReportValidationRun();
    run.reportType = reportType;
    run.sourceBatchId = sourceBatchId;
    run.horizonHours = horizonHours;
    run.status = 'pending';
    run.itemCount = 0;
    run.completedCount = 0;
    run.summary = null;
    run.error = null;
    run.startedAt = null;
    run.completedAt = null;
    run.deterministicScoreAvg = null;
    run.aiScoreAvg = null;
    run.overallScore = null;

    try {
      return await run.save();
    } catch {
      const latest = await ReportValidationRun.findOne({
        where: { reportType, sourceBatchId, horizonHours },
      });
      if (!latest) {
        throw new Error(`Failed to create report validation run for ${reportType}/${sourceBatchId}/${horizonHours}`);
      }
      return latest;
    }
  }

  private async processDueItems(): Promise<void> {
    const now = new Date();
    const staleRunningThreshold = new Date(now.getTime() - this.RUNNING_STALE_TIMEOUT_MS);
    const failedRetryThreshold = new Date(now.getTime() - this.FAILED_RETRY_INTERVAL_MS);
    const dueItems = await ReportValidationItem.find({
      where: [
        {
          status: 'pending',
          dueAt: LessThanOrEqual(now),
        },
        {
          status: 'running',
          dueAt: LessThanOrEqual(now),
          updatedAt: LessThanOrEqual(staleRunningThreshold),
        },
      ] as any,
      relations: {
        run: true,
      },
      order: {
        dueAt: 'ASC',
      },
      take: this.DUE_BATCH_LIMIT,
    });

    const remainingSlots = this.DUE_BATCH_LIMIT - dueItems.length;
    const failedRetryItems =
      remainingSlots > 0
        ? await ReportValidationItem.find({
            where: {
              status: 'failed',
              dueAt: LessThanOrEqual(now),
              updatedAt: LessThanOrEqual(failedRetryThreshold),
            } as any,
            relations: {
              run: true,
            },
            order: {
              updatedAt: 'ASC',
            },
            take: remainingSlots,
          })
        : [];
    const queuedItems = dueItems.concat(failedRetryItems);

    if (queuedItems.length < 1) {
      return;
    }

    const itemsByRunId = new Map<string, ReportValidationItem[]>();
    for (const item of queuedItems) {
      const runId = item.run.id;
      const existing = itemsByRunId.get(runId) ?? [];
      existing.push(item);
      itemsByRunId.set(runId, existing);
    }

    for (const [runId, items] of itemsByRunId.entries()) {
      const run = items[0]?.run;
      if (!run || run.id !== runId) {
        continue;
      }
      await this.processRun(run, items);
    }
  }

  private async processRun(run: ReportValidationRun, runItems: ReportValidationItem[]): Promise<void> {
    run.status = 'running';
    run.startedAt = run.startedAt ?? new Date();
    run.error = null;
    await run.save();

    const aiCandidates: ReportValidationItem[] = [];

    for (const item of runItems) {
      try {
        const deterministic = await this.evaluateItemDeterministic(item);
        item.recommendationPrice = deterministic.recommendationPrice;
        item.evaluatedPrice = deterministic.evaluatedPrice;
        item.returnPct = deterministic.returnPct;
        item.directionHit = deterministic.directionHit;
        item.deterministicScore = deterministic.deterministicScore;
        item.realizedTradePnl = deterministic.realizedTradePnl;
        item.realizedTradeAmount = deterministic.realizedTradeAmount;
        item.tradeRoiPct = deterministic.tradeRoiPct;

        if (deterministic.invalidReason) {
          item.aiVerdict = null;
          item.aiScore = null;
          item.aiCalibration = null;
          item.aiExplanation = null;
          item.nextGuardrail = null;
          item.status = 'failed';
          item.evaluatedAt = new Date();
          item.error = deterministic.invalidReason;
        } else {
          item.status = 'running';
          item.error = null;
          aiCandidates.push(item);
        }

        await item.save();
      } catch (error) {
        item.status = 'failed';
        item.error = this.errorService.getErrorMessage(error);
        item.evaluatedAt = new Date();
        await item.save();
      }
    }

    if (aiCandidates.length > 0) {
      await this.applyAiEvaluation(aiCandidates);
    }

    await this.finalizeRun(run);
  }

  private async evaluateItemDeterministic(item: ReportValidationItem): Promise<DeterministicEvaluation> {
    const recommendationPrice =
      this.toNullableNumber(item.recommendationPrice) ??
      (await this.resolvePriceAtTime(item.symbol, item.recommendationCreatedAt)) ??
      null;

    const evaluatedPrice = await this.resolvePriceAtTime(item.symbol, item.dueAt);

    if (!this.isFiniteNumber(recommendationPrice) || !this.isFiniteNumber(evaluatedPrice) || recommendationPrice <= 0) {
      return {
        recommendationPrice: recommendationPrice ?? null,
        evaluatedPrice: evaluatedPrice ?? null,
        returnPct: null,
        directionHit: null,
        deterministicScore: null,
        realizedTradePnl: null,
        realizedTradeAmount: null,
        tradeRoiPct: null,
        invalidReason: 'Unable to resolve recommendation/evaluated price',
      };
    }

    const returnPct = ((evaluatedPrice - recommendationPrice) / recommendationPrice) * 100;

    if (item.reportType === 'market') {
      const signedReturnPct = returnPct;
      const directionHit = returnPct > 0;
      const returnComponent = this.clamp((signedReturnPct + 5) / 10, 0, 1);
      const deterministicScore = this.clamp(0.7 * (directionHit ? 1 : 0) + 0.3 * returnComponent, 0, 1);

      return {
        recommendationPrice,
        evaluatedPrice,
        returnPct,
        directionHit,
        deterministicScore,
        realizedTradePnl: null,
        realizedTradeAmount: null,
        tradeRoiPct: null,
      };
    }

    const action = this.resolvePortfolioAction(item);
    const signedReturnPct = action === 'buy' ? returnPct : action === 'sell' ? -returnPct : -Math.abs(returnPct);
    const directionHit =
      action === 'buy' ? returnPct > 0 : action === 'sell' ? returnPct < 0 : Math.abs(returnPct) <= 1;
    const returnComponent = this.clamp((signedReturnPct + 5) / 10, 0, 1);

    const tradeMetrics = await this.fetchTradeMetrics(item.sourceRecommendationId, item.dueAt);
    const tradeRoiPct =
      this.isFiniteNumber(tradeMetrics.amount) && tradeMetrics.amount > 0
        ? (tradeMetrics.profit / tradeMetrics.amount) * 100
        : null;

    let deterministicScore: number;
    if (this.isFiniteNumber(tradeRoiPct)) {
      const tradeComponent = this.clamp((tradeRoiPct + 2) / 4, 0, 1);
      deterministicScore = this.clamp(
        0.5 * (directionHit ? 1 : 0) + 0.3 * returnComponent + 0.2 * tradeComponent,
        0,
        1,
      );
    } else {
      deterministicScore = this.clamp(0.7 * (directionHit ? 1 : 0) + 0.3 * returnComponent, 0, 1);
    }

    return {
      recommendationPrice,
      evaluatedPrice,
      returnPct,
      directionHit,
      deterministicScore,
      realizedTradePnl: tradeMetrics.profit,
      realizedTradeAmount: tradeMetrics.amount,
      tradeRoiPct,
    };
  }

  private resolvePortfolioAction(item: ReportValidationItem): 'buy' | 'sell' | 'hold' {
    const action = (item.recommendationAction ?? '').toLowerCase();
    if (action === 'buy' || action === 'sell' || action === 'hold') {
      return action;
    }

    const intensity = this.toNullableNumber(item.recommendationIntensity);
    if (intensity == null) {
      return 'hold';
    }
    if (intensity > 0) {
      return 'buy';
    }
    if (intensity < 0) {
      return 'sell';
    }
    return 'hold';
  }

  private async fetchTradeMetrics(inferenceId: string, dueAt: Date): Promise<{ profit: number; amount: number }> {
    try {
      const result = await Trade.createQueryBuilder('trade')
        .select('SUM(trade.profit)', 'profit')
        .addSelect('SUM(trade.amount)', 'amount')
        .where('trade.inference_id = :inferenceId', { inferenceId })
        .andWhere('trade.created_at <= :dueAt', { dueAt })
        .getRawOne();

      return {
        profit: this.toNumber(result?.profit),
        amount: this.toNumber(result?.amount),
      };
    } catch {
      return {
        profit: 0,
        amount: 0,
      };
    }
  }

  private async applyAiEvaluation(items: ReportValidationItem[]): Promise<void> {
    const requestConfig = {
      ...REPORT_VALIDATION_EVALUATOR_CONFIG,
      text: {
        format: {
          type: 'json_schema' as const,
          name: 'report_validation_evaluator',
          strict: true,
          schema: REPORT_VALIDATION_EVALUATOR_RESPONSE_SCHEMA as Record<string, unknown>,
        },
      },
    };

    const batchRequestLines = items.map((item) => {
      const messages = this.buildEvaluatorMessages(item);
      return this.openaiService.createBatchRequest(item.id, messages, requestConfig);
    });

    try {
      const batchId = await this.openaiService.createBatch(batchRequestLines.join('\n'));
      const batchResults = await this.openaiService.waitBatch(
        batchId,
        this.OPENAI_BATCH_MAX_WAIT_MS,
        this.OPENAI_BATCH_POLL_INTERVAL_MS,
      );
      const resultMap = new Map<string, any>(batchResults.map((result) => [result.custom_id, result]));

      for (const item of items) {
        const result = resultMap.get(item.id);
        if (!result || result.error || !result.data) {
          item.status = 'failed';
          item.error = result?.error ?? 'Missing GPT evaluation result';
          item.evaluatedAt = new Date();
          await item.save();
          continue;
        }

        const verdict = String(result.data.verdict ?? '').toLowerCase() as ReportValidationVerdict;
        item.aiVerdict = ['good', 'mixed', 'bad', 'invalid'].includes(verdict) ? verdict : 'invalid';
        item.aiScore = this.toNullableNumber(result.data.score);
        item.aiCalibration = this.toNullableNumber(result.data.calibration);
        item.aiExplanation = typeof result.data.explanation === 'string' ? result.data.explanation : null;
        item.nextGuardrail = typeof result.data.nextGuardrail === 'string' ? result.data.nextGuardrail : null;
        item.status = 'completed';
        item.evaluatedAt = new Date();
        item.error = null;
        await item.save();
      }
    } catch (error) {
      for (const item of items) {
        item.status = 'failed';
        item.error = this.errorService.getErrorMessage(error);
        item.evaluatedAt = new Date();
      }
      await ReportValidationItem.save(items, { chunk: 100 });
    }
  }

  private buildEvaluatorMessages(item: ReportValidationItem): EasyInputMessage[] {
    const messages: EasyInputMessage[] = [];
    this.openaiService.addMessage(messages, 'system', REPORT_VALIDATION_EVALUATOR_PROMPT);

    const payload = {
      reportType: item.reportType,
      symbol: item.symbol,
      horizonHours: item.horizonHours,
      recommendation: {
        reason: item.recommendationReason,
        confidence: item.recommendationConfidence,
        weight: item.recommendationWeight,
        intensity: item.recommendationIntensity,
        action: item.recommendationAction,
        recommendationPrice: item.recommendationPrice,
        recommendationCreatedAt: item.recommendationCreatedAt,
      },
      observed: {
        evaluatedPrice: item.evaluatedPrice,
        returnPct: item.returnPct,
        directionHit: item.directionHit,
        deterministicScore: item.deterministicScore,
        realizedTradePnl: item.realizedTradePnl,
        realizedTradeAmount: item.realizedTradeAmount,
        tradeRoiPct: item.tradeRoiPct,
      },
    };

    this.openaiService.addMessage(messages, 'user', JSON.stringify(payload, null, 2));
    return messages;
  }

  private async finalizeRun(run: ReportValidationRun): Promise<void> {
    const items = await ReportValidationItem.find({
      where: {
        run: {
          id: run.id,
        },
      } as any,
    });

    const completedItems = items.filter((item) => item.status === 'completed');
    const failedItems = items.filter((item) => item.status === 'failed');
    const pendingOrRunningItems = items.filter((item) => item.status === 'pending' || item.status === 'running');
    const deterministicScores = completedItems
      .map((item) => this.toNullableNumber(item.deterministicScore))
      .filter((score): score is number => score != null);
    const aiScores = completedItems
      .map((item) => this.toNullableNumber(item.aiScore))
      .filter((score): score is number => score != null);

    run.itemCount = items.length;
    run.completedCount = completedItems.length;
    run.deterministicScoreAvg = this.average(deterministicScores);
    run.aiScoreAvg = this.average(aiScores);
    run.overallScore = this.calculateRunOverallScore(run.deterministicScoreAvg, run.aiScoreAvg);
    run.summary = this.buildRunSummary(completedItems);

    const isTerminal = pendingOrRunningItems.length < 1;
    run.status = isTerminal
      ? failedItems.length > 0 && completedItems.length < 1
        ? 'failed'
        : 'completed'
      : 'running';
    run.completedAt = isTerminal ? new Date() : null;
    run.error =
      failedItems.length > 0
        ? `failed items=${failedItems.length}, sample=${failedItems
            .slice(0, 3)
            .map((item) => item.symbol)
            .join(',')}`
        : null;

    await run.save();

    if (run.reportType === 'portfolio' && isTerminal) {
      this.clearPortfolioGlobalGuardrailsCache();
    }
    if (run.reportType === 'market' && isTerminal) {
      this.clearMarketMinConfidenceCache();
    }

    if (isTerminal && failedItems.length > 0) {
      await this.safeNotifyServer(
        this.i18n.t('notify.reportValidation.partially_failed', {
          args: {
            runId: run.id,
            reportType: run.reportType,
            sourceBatchId: run.sourceBatchId,
            horizonHours: run.horizonHours,
            failedCount: failedItems.length,
          },
        }),
      );
    }
  }

  private buildRunSummary(items: ReportValidationItem[]): string {
    const validItems = items.filter((item) => item.aiVerdict !== 'invalid');
    if (validItems.length < 1) {
      return this.i18n.t('logging.reportValidation.summary.no_valid_items');
    }

    const overallScores = validItems
      .map((item) => this.calculateItemOverallScore(item))
      .filter((score): score is number => this.isFiniteNumber(score));
    const lowScoreItems = validItems.filter((item) => {
      const score = this.calculateItemOverallScore(item);
      return this.isFiniteNumber(score) && score < this.LOW_SCORE_THRESHOLD;
    });
    const topGuardrails = this.extractTopGuardrails(lowScoreItems, 3);
    const accuracy = this.calculateAccuracy(validItems);
    const avgReturn = this.average(
      validItems.map((item) => this.toNullableNumber(item.returnPct)).filter((value): value is number => value != null),
    );
    const avgOverall = this.average(overallScores);
    const avgReturnText =
      avgReturn != null ? `${avgReturn.toFixed(2)}%` : this.i18n.t('logging.reportValidation.summary.na');
    const avgOverallText =
      avgOverall != null ? avgOverall.toFixed(4) : this.i18n.t('logging.reportValidation.summary.na');
    const guardrailsText =
      topGuardrails.length > 0 ? topGuardrails.join(' | ') : this.i18n.t('logging.reportValidation.summary.none');

    return [
      this.i18n.t('logging.reportValidation.summary.accuracy', {
        args: {
          ratio: accuracy.ratio.toFixed(2),
          hit: accuracy.hit,
          total: accuracy.total,
        },
      }),
      this.i18n.t('logging.reportValidation.summary.avg_return', {
        args: {
          value: avgReturnText,
        },
      }),
      this.i18n.t('logging.reportValidation.summary.avg_overall', {
        args: {
          value: avgOverallText,
        },
      }),
      this.i18n.t('logging.reportValidation.summary.low_score', {
        args: {
          count: lowScoreItems.length,
        },
      }),
      this.i18n.t('logging.reportValidation.summary.guardrails', {
        args: {
          value: guardrailsText,
        },
      }),
    ].join(', ');
  }

  private extractTopGuardrails(items: ReportValidationItem[], limit: number): string[] {
    const counts = new Map<string, number>();
    for (const item of items) {
      const guardrail = (item.nextGuardrail ?? '').trim();
      if (!guardrail) {
        continue;
      }
      counts.set(guardrail, (counts.get(guardrail) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([guardrail]) => guardrail);
  }

  private async getPortfolioGlobalGuardrails(): Promise<string[]> {
    const now = Date.now();

    if (this.portfolioGlobalGuardrailsCache && this.portfolioGlobalGuardrailsCache.expiresAt > now) {
      return this.portfolioGlobalGuardrailsCache.guardrails;
    }

    if (this.portfolioGlobalGuardrailsInFlight) {
      return this.portfolioGlobalGuardrailsInFlight;
    }

    const loadPromise = (async () => {
      const since = new Date(Date.now() - this.VALIDATION_SUMMARY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
      const globalItems = await ReportValidationItem.find({
        where: {
          reportType: 'portfolio',
          status: 'completed',
          createdAt: MoreThanOrEqual(since),
        } as any,
        order: {
          createdAt: 'DESC',
        },
        take: 2000,
      });

      const guardrails = this.extractTopGuardrails(
        globalItems.filter((item) => item.aiVerdict !== 'invalid'),
        4,
      );
      this.portfolioGlobalGuardrailsCache = {
        expiresAt: Date.now() + this.PORTFOLIO_GLOBAL_GUARDRAIL_CACHE_TTL_MS,
        guardrails,
      };
      return guardrails;
    })();

    this.portfolioGlobalGuardrailsInFlight = loadPromise;
    try {
      return await loadPromise;
    } finally {
      if (this.portfolioGlobalGuardrailsInFlight === loadPromise) {
        this.portfolioGlobalGuardrailsInFlight = null;
      }
    }
  }

  private clearPortfolioGlobalGuardrailsCache(): void {
    this.portfolioGlobalGuardrailsCache = null;
  }

  private resolveMarketMinConfidenceFromValidation(items: ReportValidationItem[]): number | null {
    const samples: ConfidenceCalibrationSample[] = items
      .filter(
        (item) =>
          item.aiVerdict !== 'invalid' &&
          item.directionHit != null &&
          this.isFiniteNumber(item.recommendationConfidence),
      )
      .map((item) => ({
        confidence: this.clamp(Number(item.recommendationConfidence), 0, 1),
        directionHit: item.directionHit === true,
        horizonHours: Number(item.horizonHours),
      }));

    if (samples.length < this.PORTFOLIO_MARKET_MIN_CONFIDENCE_MIN_TOTAL_SAMPLES) {
      return null;
    }

    const samples24h = samples.filter((item) => item.horizonHours === 24);
    const pool = samples24h.length >= this.PORTFOLIO_MARKET_MIN_CONFIDENCE_MIN_TOTAL_SAMPLES ? samples24h : samples;
    if (pool.length < this.PORTFOLIO_MARKET_MIN_CONFIDENCE_MIN_TOTAL_SAMPLES) {
      return null;
    }

    const baselineHitRate = this.calculateDirectionHitRate(pool);
    const targetHitRate = Math.max(
      this.PORTFOLIO_MARKET_MIN_CONFIDENCE_TARGET_HIT_RATE,
      baselineHitRate + this.PORTFOLIO_MARKET_MIN_CONFIDENCE_TARGET_LIFT,
    );

    let fallback: { threshold: number; hitRate: number; sampleCount: number } | null = null;

    for (
      let threshold = this.PORTFOLIO_MARKET_MIN_CONFIDENCE_MIN;
      threshold <= this.PORTFOLIO_MARKET_MIN_CONFIDENCE_MAX + Number.EPSILON;
      threshold += this.PORTFOLIO_MARKET_MIN_CONFIDENCE_STEP
    ) {
      const normalizedThreshold = this.clamp(Math.round(threshold * 100) / 100, 0, 1);
      const bucket = pool.filter((item) => item.confidence >= normalizedThreshold);
      const sampleCount = bucket.length;
      const coverage = sampleCount / pool.length;

      if (
        sampleCount < this.PORTFOLIO_MARKET_MIN_CONFIDENCE_MIN_BUCKET_SAMPLES ||
        coverage < this.PORTFOLIO_MARKET_MIN_CONFIDENCE_MIN_COVERAGE
      ) {
        continue;
      }

      const hitRate = this.calculateDirectionHitRate(bucket);
      if (hitRate >= targetHitRate) {
        return normalizedThreshold;
      }

      if (
        !fallback ||
        hitRate > fallback.hitRate ||
        (Math.abs(hitRate - fallback.hitRate) < Number.EPSILON && sampleCount > fallback.sampleCount)
      ) {
        fallback = {
          threshold: normalizedThreshold,
          hitRate,
          sampleCount,
        };
      }
    }

    if (fallback && fallback.hitRate >= baselineHitRate + this.PORTFOLIO_MARKET_MIN_CONFIDENCE_TARGET_LIFT / 2) {
      return fallback.threshold;
    }

    return null;
  }

  private calculateDirectionHitRate(items: Array<Pick<ConfidenceCalibrationSample, 'directionHit'>>): number {
    if (items.length < 1) {
      return 0;
    }

    const hit = items.filter((item) => item.directionHit).length;
    return hit / items.length;
  }

  private clearMarketMinConfidenceCache(): void {
    this.marketMinConfidenceCache = null;
    this.marketMinConfidenceInFlight = null;
    this.marketMinConfidenceCacheGeneration += 1;
  }

  private calculateAccuracy(items: ReportValidationItem[]): { hit: number; total: number; ratio: number } {
    const directional = items.filter((item) => item.directionHit != null);
    const hit = directional.filter((item) => item.directionHit === true).length;
    const total = directional.length;
    return {
      hit,
      total,
      ratio: total > 0 ? (hit / total) * 100 : 0,
    };
  }

  private calculateItemOverallScore(item: Pick<ReportValidationItem, 'deterministicScore' | 'aiScore'>): number | null {
    const deterministic = this.toNullableNumber(item.deterministicScore);
    const aiScore = this.toNullableNumber(item.aiScore);

    if (deterministic != null && aiScore != null) {
      return this.clamp(0.6 * deterministic + 0.4 * aiScore, 0, 1);
    }

    if (deterministic != null) {
      return this.clamp(deterministic, 0, 1);
    }

    if (aiScore != null) {
      return this.clamp(aiScore, 0, 1);
    }

    return null;
  }

  private calculateRunOverallScore(deterministic: number | null, ai: number | null): number | null {
    const deterministicScore = this.toNullableNumber(deterministic);
    const aiScore = this.toNullableNumber(ai);

    if (deterministicScore != null && aiScore != null) {
      return this.clamp(0.6 * deterministicScore + 0.4 * aiScore, 0, 1);
    }
    if (deterministicScore != null) {
      return this.clamp(deterministicScore, 0, 1);
    }
    if (aiScore != null) {
      return this.clamp(aiScore, 0, 1);
    }
    return null;
  }

  private async resolvePriceAtTime(symbol: string, time: Date): Promise<number | undefined> {
    try {
      const minuteOpen = await this.upbitService.getMinuteCandleAt(symbol, time);
      if (this.isFiniteNumber(minuteOpen) && minuteOpen > 0) {
        return minuteOpen;
      }
    } catch {
      // no-op
    }

    try {
      const marketData = await this.upbitService.getMarketData(symbol);
      const currentPrice = this.toNullableNumber(marketData?.ticker?.last);
      const candles1d = marketData?.candles1d ?? [];
      const targetDate = new Date(time).toISOString().slice(0, 10);
      const sameDate = candles1d.find(
        (candle: number[]) => new Date(candle[0]).toISOString().slice(0, 10) === targetDate,
      );

      if (sameDate && sameDate.length >= 5 && this.isFiniteNumber(sameDate[4])) {
        return Number(sameDate[4]);
      }

      if (candles1d.length > 0) {
        const last = candles1d[candles1d.length - 1];
        if (last && last.length >= 5 && this.isFiniteNumber(last[4])) {
          return Number(last[4]);
        }
      }

      return currentPrice ?? undefined;
    } catch {
      return undefined;
    }
  }

  private resolvePortfolioRecommendationConfidence(recommendation: BalanceRecommendation): number | null {
    const fromReason = this.extractConfidenceFromReason(recommendation.reason);
    if (fromReason != null) {
      return fromReason;
    }

    const intensity = this.toNullableNumber(recommendation.intensity);
    if (intensity == null) {
      return null;
    }

    return this.clamp(Math.abs(intensity), 0, 1);
  }

  private extractConfidenceFromReason(reason: string | null | undefined): number | null {
    if (typeof reason !== 'string' || reason.trim() === '') {
      return null;
    }

    const normalized = reason.replace(/,/g, '.');
    const candidates = [
      /confidence\s*[:=]\s*([01](?:\.\d+)?)/i,
      /신뢰도\s*[:=]\s*([01](?:\.\d+)?)/i,
      /확신도\s*[:=]\s*([01](?:\.\d+)?)/i,
    ];

    for (const pattern of candidates) {
      const matched = normalized.match(pattern);
      if (!matched || !matched[1]) {
        continue;
      }

      const parsed = this.toNullableNumber(matched[1]);
      if (parsed == null) {
        continue;
      }

      return this.clamp(parsed, 0, 1);
    }

    return null;
  }

  private clampLimit(value: number | undefined, fallback: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    const parsed = Math.floor(Number(value));
    if (parsed < min) return min;
    if (parsed > max) return max;
    return parsed;
  }

  private clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }

    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  private average(values: number[]): number | null {
    if (values.length < 1) {
      return null;
    }

    const sum = values.reduce((acc, value) => acc + value, 0);
    return sum / values.length;
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private toNullableNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private toNumber(value: unknown): number {
    const parsed = this.toNullableNumber(value);
    return parsed ?? 0;
  }

  private toNonNegativeInteger(value: unknown): number {
    const parsed = this.toNullableNumber(value);
    if (parsed == null) {
      return 0;
    }
    return Math.max(0, Math.floor(parsed));
  }

  private async safeNotifyServer(message: string): Promise<void> {
    try {
      await this.notifyService.notifyServer(message);
    } catch (error) {
      this.logger.warn(this.i18n.t('logging.reportValidation.task.notify_failed'), error);
    }
  }
}
