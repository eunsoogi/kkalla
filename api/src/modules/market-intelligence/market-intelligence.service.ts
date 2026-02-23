import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { I18nService } from 'nestjs-i18n';
import type { EasyInputMessage } from 'openai/resources/responses/responses';

import { RecommendationItem } from '@/modules/allocation-core/allocation-core.types';
import {
  fetchCoinNewsWithFallback,
  fetchFearGreedIndexWithFallback,
} from '@/modules/allocation-core/helpers/allocation-recommendation-context';
import { filterUniqueNonBlacklistedItems } from '@/modules/allocation-core/helpers/recommendation-item';
import { CacheService } from '@/modules/cache/cache.service';
import { ErrorService } from '@/modules/error/error.service';
import { FeargreedService } from '@/modules/feargreed/feargreed.service';
import { FeatureService } from '@/modules/feature/feature.service';
import { CursorItem, PaginatedItem } from '@/modules/item/item.interface';
import { NewsService } from '@/modules/news/news.service';
import { toUserFacingText } from '@/modules/openai/openai-citation.util';
import { OpenaiService } from '@/modules/openai/openai.service';
import type { KrwTickerDailyData } from '@/modules/upbit/upbit.interface';
import { UpbitService } from '@/modules/upbit/upbit.service';
import { normalizeKrwSymbol } from '@/utils/symbol';

import { AllocationAuditService } from '../allocation-audit/allocation-audit.service';
import { BlacklistService } from '../blacklist/blacklist.service';
import { Category } from '../category/category.enum';
import { NotifyService } from '../notify/notify.service';
import { WithRedlock } from '../redlock/decorators/redlock.decorator';
import { GetMarketSignalsCursorDto } from './dto/get-market-signals-cursor.dto';
import { GetMarketSignalsPaginationDto } from './dto/get-market-signals-pagination.dto';
import { MarketSignalWithChangeDto } from './dto/market-signal-with-change.dto';
import { MarketSignalDto } from './dto/market-signal.dto';
import { MarketSignal } from './entities/market-signal.entity';
import { MARKET_SIGNAL_LOCK, ScheduleExpression } from './market-intelligence.enum';
import {
  MARKET_SIGNAL_STATE_CACHE_KEY,
  MARKET_SIGNAL_STATE_CACHE_TTL_SECONDS,
  MarketSignalData,
  MarketSignalState,
} from './market-intelligence.interface';
import {
  UPBIT_MARKET_SIGNAL_CONFIG,
  UPBIT_MARKET_SIGNAL_PROMPT,
  UPBIT_MARKET_SIGNAL_RESPONSE_SCHEMA,
} from './prompts/market-signal.prompt';

interface LatestPriceChangeOptions {
  mode?: 'exact' | 'mixed' | 'approx';
}

interface SaveMarketSignalOptions {
  recommendationTime?: Date;
  marketData?: KrwTickerDailyData | null;
}

interface SignalPriceResolution {
  price?: number;
  source: 'minute' | 'fallback' | 'none';
}

/**
 * 시장 조사 모듈의 핵심 서비스.
 *
 * - 모든 KRW 마켓 종목을 조회하여 시장 시그널을 수행한다.
 * - 일일 스케줄로 실행되며, 추천 결과를 서버에 알림으로 전송한다.
 */
@Injectable()
export class MarketIntelligenceService {
  private readonly logger = new Logger(MarketIntelligenceService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly notifyService: NotifyService,
    private readonly blacklistService: BlacklistService,
    private readonly upbitService: UpbitService,
    private readonly cacheService: CacheService,
    private readonly newsService: NewsService,
    private readonly feargreedService: FeargreedService,
    private readonly openaiService: OpenaiService,
    private readonly featureService: FeatureService,
    private readonly errorService: ErrorService,
    private readonly allocationAuditService: AllocationAuditService,
  ) {}

  /**
   * 일일 시장 시그널 스케줄
   *
   * - 매일 자정(00:00)에 실행됩니다.
   * - 모든 KRW 마켓 종목을 조회하여 시장 시그널을 수행합니다.
   * - 블랙리스트에 등록된 종목은 제외합니다.
   * - 추천 결과를 서버 Slack 채널로 알림 전송합니다.
   * - 추천된 종목은 MarketSignal 엔티티에 저장되어 Allocation 모듈에서 활용됩니다.
   */
  @Cron(ScheduleExpression.DAILY_MARKET_SIGNAL)
  @WithRedlock(MARKET_SIGNAL_LOCK) // 24시간 30분 동안 실행
  public async executeMarketSignal(): Promise<void> {
    // 개발 환경에서는 스케줄 실행을 건너뜀
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(this.i18n.t('logging.schedule.skip'));
      return;
    }

    await this.executeMarketSignalTask();
  }

  /**
   * Runs market signal task in the market signal workflow.
   */
  public async executeMarketSignalTask(): Promise<void> {
    this.logger.log(this.i18n.t('logging.schedule.marketSignal.start'));

    try {
      // 모든 KRW 마켓 종목 가져오기
      const allKrwSymbols = await this.upbitService.getAllKrwMarkets();

      // RecommendationItem 형식으로 변환
      // 모든 종목을 COIN_MINOR 카테고리로 설정하고 추론 가능한 형태로 변환
      let inferenceItems: RecommendationItem[] = allKrwSymbols.map((symbol) => ({
        symbol,
        category: Category.COIN_MINOR, // 기본 카테고리를 COIN_MINOR로 설정
        hasStock: false,
      }));

      // 블랙리스트 필터링: 중복 제거 및 블랙리스트 종목 제외
      inferenceItems = await this.filterSignalCandidates(inferenceItems);
      const filteredSymbols = inferenceItems.map((item) => item.symbol);

      this.logger.log(
        this.i18n.t('logging.schedule.marketSignal.filtered', { args: { count: filteredSymbols.length } }),
      );

      // 필터링된 종목으로 추천 요청: AI 추론 서비스를 통해 시장 시그널 수행
      const recommendations = await this.marketSignal(filteredSymbols);

      // 추천 결과를 서버 Slack 채널로 알림 전송
      // 각 추천 종목의 심볼과 추천 이유를 포맷팅하여 전송
      await this.notifyService.notifyServer(
        this.i18n.t('notify.marketSignal.result', {
          args: {
            transactions: recommendations
              .map((recommendation) =>
                this.i18n.t('notify.marketSignal.transaction', {
                  args: {
                    symbol: recommendation.symbol,
                    reason: toUserFacingText(recommendation.reason),
                  },
                }),
              )
              .join('\n\n'),
          },
        }),
      );

      this.logger.log(
        this.i18n.t('logging.schedule.marketSignal.completed', {
          args: {
            count: recommendations?.length || 0,
          },
        }),
      );
    } catch (error) {
      // 오류 발생 시 로그 기록 후 예외 재발생하지 않음 (스케줄 안정성)
      this.logger.error(this.i18n.t('logging.schedule.marketSignal.failed'), error);
    }
  }

  /**
   * 블랙리스트 필터링
   *
   * - 중복 종목 제거 및 블랙리스트에 등록된 종목을 제외합니다.
   * - 시장 시그널 대상에서 제외할 종목을 필터링합니다.
   *
   * @param items 추론 대상 종목 목록
   * @returns 필터링된 추론 대상 종목 목록
   */
  private async filterSignalCandidates(items: RecommendationItem[]): Promise<RecommendationItem[]> {
    const blacklist = await this.blacklistService.findAll();
    return filterUniqueNonBlacklistedItems(items, blacklist).items;
  }

  /**
   * 전체 KRW 마켓에서 상위 10개 종목 추천
   *
   * - AI를 활용하여 전체 KRW 마켓에서 투자 가치가 높은 상위 10개 종목을 추천합니다.
   * - 배치 요청을 사용하여 효율적으로 처리합니다.
   * - 추천 결과를 데이터베이스에 저장합니다.
   *
   * @param symbols 추천 대상 종목 목록 (선택적)
   * @returns 저장된 상위 10개 종목 추천 결과
   */
  public async marketSignal(symbols?: string[]): Promise<MarketSignalData[]> {
    this.logger.log(this.i18n.t('logging.inference.marketSignal.start'));

    // 메시지 빌드
    this.logger.log(this.i18n.t('logging.inference.marketSignal.build_msg_start'));

    const messages = await this.errorService.retryWithFallback(() => this.buildMarketSignalMessages(symbols));

    this.logger.log(this.i18n.t('logging.inference.marketSignal.build_msg_complete'));

    // 배치 요청 처리
    this.logger.log(this.i18n.t('logging.inference.marketSignal.batch_start'));

    const inferenceResult = await this.errorService.retryWithFallback(async () => {
      const requestConfig = {
        ...UPBIT_MARKET_SIGNAL_CONFIG,
        text: {
          format: {
            type: 'json_schema' as const,
            name: 'market_signal',
            strict: true,
            schema: UPBIT_MARKET_SIGNAL_RESPONSE_SCHEMA as Record<string, unknown>,
          },
        },
      };

      const batchRequest = this.openaiService.createBatchRequest('market-signal', messages, requestConfig);
      const batchId = await this.openaiService.createBatch(batchRequest);
      const batchResults = await this.openaiService.waitBatch(batchId);

      const batchResult = batchResults[0];
      if (batchResult.error) {
        throw new Error(`Batch request failed: ${JSON.stringify(batchResult.error)}`);
      }

      return {
        batchId,
        recommendations: batchResult.data.recommendations,
      };
    });

    this.logger.log(this.i18n.t('logging.inference.marketSignal.batch_complete'));

    const normalizedRecommendations = this.normalizeMarketSignals(inferenceResult.recommendations, symbols);
    const hasRecommendations = normalizedRecommendations.length > 0;

    // 추론 결과가 없으면 빈 배열 반환
    if (!hasRecommendations) {
      await this.cacheLatestSignalState(inferenceResult.batchId, false);
      this.logger.log(this.i18n.t('logging.inference.marketSignal.complete'));
      return [];
    }

    // 결과 저장
    this.logger.log(
      this.i18n.t('logging.inference.marketSignal.presave', {
        args: { count: normalizedRecommendations.length },
      }),
    );

    const recommendationTime = new Date();
    const marketDataMap = await this.upbitService.getTickerAndDailyDataBatch(
      normalizedRecommendations.map((recommendation) => recommendation.symbol),
    );
    const recommendationResults = await Promise.all(
      normalizedRecommendations.map((recommendation) =>
        this.saveMarketSignal(
          { ...recommendation, batchId: inferenceResult.batchId },
          {
            recommendationTime,
            marketData: marketDataMap.get(recommendation.symbol),
          },
        ),
      ),
    );

    this.logger.log(
      this.i18n.t('logging.inference.marketSignal.save', { args: { count: recommendationResults.length } }),
    );

    this.logger.log(this.i18n.t('logging.inference.marketSignal.complete'));
    await this.cacheLatestSignalState(inferenceResult.batchId, true);
    this.allocationAuditService
      .enqueueMarketBatchValidation(inferenceResult.batchId)
      .catch((error) =>
        this.logger.warn(this.i18n.t('logging.inference.marketSignal.enqueue_validation_failed'), error),
      );

    return recommendationResults.map((saved) => ({
      id: saved.id,
      batchId: saved.batchId,
      symbol: saved.symbol,
      weight: saved.weight,
      reason: toUserFacingText(saved.reason),
      confidence: saved.confidence,
    }));
  }

  /**
   * Handles cache latest signal state in the market signal workflow.
   * @param batchId - Identifier for the target resource.
   * @param hasRecommendations - Input value for has recommendations.
   */
  private async cacheLatestSignalState(batchId: string, hasRecommendations: boolean): Promise<void> {
    const state: MarketSignalState = {
      batchId,
      hasRecommendations,
      updatedAt: Date.now(),
    };

    try {
      await this.cacheService.set(MARKET_SIGNAL_STATE_CACHE_KEY, state, MARKET_SIGNAL_STATE_CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(
        this.i18n.t('logging.cache.set_failed', {
          args: { key: MARKET_SIGNAL_STATE_CACHE_KEY },
        }),
        error,
      );
    }
  }

  /**
   * 마켓 분석 메시지 빌드
   *
   * - 뉴스, 공포탐욕지수, 시장 특성 데이터를 포함한 프롬프트를 구성합니다.
   *
   * @param symbols 추천 대상 종목 목록 (선택적)
   * @returns OpenAI API용 메시지 배열
   */
  private async buildMarketSignalMessages(symbols?: string[]): Promise<EasyInputMessage[]> {
    const messages: EasyInputMessage[] = [];

    // 시스템 프롬프트 추가
    this.openaiService.addMessage(messages, 'system', UPBIT_MARKET_SIGNAL_PROMPT);

    // 뉴스 데이터 추가
    const news = await fetchCoinNewsWithFallback({
      newsService: this.newsService,
      errorService: this.errorService,
      onError: (error) => this.logger.error(this.i18n.t('logging.news.load_failed'), error),
    });
    if (news && news.length > 0) {
      this.openaiService.addMessagePair(messages, 'prompt.input.news', news);
    }

    // 공포탐욕지수 추가
    const feargreed = await fetchFearGreedIndexWithFallback({
      feargreedService: this.feargreedService,
      errorService: this.errorService,
      onError: (error) => this.logger.error(this.i18n.t('logging.feargreed.load_failed'), error),
    });
    if (feargreed) {
      this.openaiService.addMessagePair(messages, 'prompt.input.feargreed', feargreed);
    }

    try {
      const validationSummary = await this.allocationAuditService.buildMarketValidationGuardrailText();
      if (validationSummary) {
        this.openaiService.addMessagePair(messages, 'prompt.input.validation_market', validationSummary);
      }
    } catch (error) {
      this.logger.warn(this.i18n.t('logging.inference.marketSignal.validation_guardrail_load_failed'), error);
    }

    // 종목 feature 데이터 추가
    const marketFeatures = await this.featureService.extractAllKrwMarketFeatures(symbols);
    const marketData = this.featureService.formatMarketData(marketFeatures);
    this.openaiService.addMessage(messages, 'user', `${this.featureService.MARKET_DATA_LEGEND}\n\n${marketData}`);

    return messages;
  }

  /**
   * 시장 시그널 결과 페이지네이션
   *
   * @param params 페이지네이션 파라미터
   * @returns 페이지네이션된 시장 시그널 결과
   */
  public async paginateMarketSignals(params: GetMarketSignalsPaginationDto): Promise<PaginatedItem<MarketSignalDto>> {
    const paginatedResult = await MarketSignal.paginate(params as any);
    const badgeMap = await this.getMarketValidationBadgeMapSafe(paginatedResult.items.map((entity) => entity.id));

    const items = paginatedResult.items.map((entity) => {
      const validation = badgeMap.get(entity.id) ?? {};
      return {
        id: entity.id,
        seq: entity.seq,
        symbol: entity.symbol,
        weight: Number(entity.weight),
        reason: toUserFacingText(entity.reason),
        confidence: Number(entity.confidence),
        batchId: entity.batchId,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        validation24h: validation.validation24h,
        validation72h: validation.validation72h,
      };
    });

    return {
      ...paginatedResult,
      items,
    };
  }

  /**
   * 시장 시그널 결과 커서 페이지네이션
   *
   * @param params 커서 페이지네이션 파라미터
   * @returns 커서 페이지네이션된 시장 시그널 결과
   */
  public async cursorMarketSignals(params: GetMarketSignalsCursorDto): Promise<CursorItem<MarketSignalDto, string>> {
    const cursorResult = await MarketSignal.cursor(params as any);
    const badgeMap = await this.getMarketValidationBadgeMapSafe(cursorResult.items.map((entity) => entity.id));
    const items = cursorResult.items.map((entity) => ({
      ...(badgeMap.get(entity.id) ?? {}),
      id: entity.id,
      seq: entity.seq,
      symbol: entity.symbol,
      weight: Number(entity.weight),
      reason: toUserFacingText(entity.reason),
      confidence: Number(entity.confidence),
      batchId: entity.batchId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    }));

    return {
      ...cursorResult,
      items,
    };
  }

  /**
   * 시장 시그널 결과 저장
   *
   * @param recommendation 시장 시그널 데이터
   * @returns 저장된 시장 시그널 엔티티
   */
  public async saveMarketSignal(
    recommendation: MarketSignalData,
    options?: SaveMarketSignalOptions,
  ): Promise<MarketSignal> {
    const normalizedSymbol = normalizeKrwSymbol(recommendation.symbol);
    if (!normalizedSymbol) {
      throw new Error(`Invalid market recommendation symbol: ${recommendation.symbol}`);
    }

    const recommendationTime = options?.recommendationTime ?? new Date();
    const recommendationPrice = await this.resolveSignalPriceAtTime(
      normalizedSymbol,
      recommendationTime,
      options?.marketData,
      true,
    );

    const marketSignal = new MarketSignal();
    Object.assign(marketSignal, recommendation, { symbol: normalizedSymbol });
    marketSignal.recommendationPrice = recommendationPrice ?? null;
    return marketSignal.save();
  }

  /**
   * 최신 마켓 추천 배치를 조회하고, 추천 시점 대비 현재가 변동률을 계산하여 반환 (메인 대시보드용)
   */
  public async getLatestWithPriceChange(
    limit = 10,
    options?: LatestPriceChangeOptions,
  ): Promise<MarketSignalWithChangeDto[]> {
    const latest = await MarketSignal.getLatestSignals();
    if (latest.length < 1) {
      return [];
    }

    const mode = options?.mode ?? 'exact';
    const backfilledPriceMap = await this.backfillLatestBatchSignalPrices(latest, mode);

    const items = [...latest].sort((a, b) => Number(b.confidence) - Number(a.confidence)).slice(0, limit);
    const badgeMap = await this.getMarketValidationBadgeMapSafe(items.map((entity) => entity.id));
    const marketDataMap = await this.upbitService.getTickerAndDailyDataBatch(items.map((item) => item.symbol));

    const recentCandidateSet = this.buildMinuteLookupCandidateSet(items, mode);

    const result: MarketSignalWithChangeDto[] = await Promise.all(
      items.map(async (entity) => {
        let recommendationPrice: number | undefined =
          this.toPositiveNumber(entity.recommendationPrice) ?? backfilledPriceMap.get(entity.id);
        let currentPrice: number | undefined;
        let priceChangePct: number | undefined;

        try {
          const marketData = marketDataMap.get(entity.symbol);
          currentPrice = this.toFiniteNumber(marketData?.ticker?.last);

          if (recommendationPrice == null) {
            const shouldUseMinutePrice = mode === 'exact' || (mode === 'mixed' && recentCandidateSet.has(entity.id));
            recommendationPrice = await this.resolveSignalPriceAtTime(
              entity.symbol,
              entity.createdAt,
              marketData,
              shouldUseMinutePrice,
            );
          }

          if (recommendationPrice != null && recommendationPrice > 0 && currentPrice != null) {
            priceChangePct = Number((((currentPrice - recommendationPrice) / recommendationPrice) * 100).toFixed(2));
          }
        } catch {
          // 가격 조회 실패 시 변동률만 비움
        }

        return {
          ...(badgeMap.get(entity.id) ?? {}),
          id: entity.id,
          seq: entity.seq,
          symbol: entity.symbol,
          weight: Number(entity.weight),
          reason: toUserFacingText(entity.reason),
          confidence: Number(entity.confidence),
          batchId: entity.batchId,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
          recommendationPrice,
          currentPrice,
          priceChangePct,
        };
      }),
    );

    return result;
  }

  /**
   * Handles backfill latest batch signal prices in the market signal workflow.
   * @param latestBatchItems - Collection of items used by the market signal flow.
   * @param mode - Input value for mode.
   * @returns Computed numeric value for the operation.
   */
  private async backfillLatestBatchSignalPrices(
    latestBatchItems: MarketSignal[],
    mode: 'exact' | 'mixed' | 'approx',
  ): Promise<Map<string, number>> {
    const targets = latestBatchItems.filter((item) => this.toPositiveNumber(item.recommendationPrice) == null);
    if (targets.length < 1) {
      return new Map();
    }

    const marketDataMap = await this.upbitService.getTickerAndDailyDataBatch(targets.map((item) => item.symbol));
    const recentCandidateSet = this.buildMinuteLookupCandidateSet(targets, mode);

    const entries = await Promise.all(
      targets.map(async (item): Promise<[string, number] | null> => {
        const shouldUseMinutePrice = mode === 'exact' || (mode === 'mixed' && recentCandidateSet.has(item.id));
        const resolution = await this.resolveSignalPriceAtTimeWithSource(
          item.symbol,
          item.createdAt,
          marketDataMap.get(item.symbol),
          shouldUseMinutePrice,
        );
        const recommendationPrice = resolution.price;

        if (recommendationPrice == null) {
          return null;
        }

        // mixed 모드에서는 분봉을 실제로 조회해 얻은 가격만 영속화한다.
        const shouldPersist = mode === 'exact' || (mode === 'mixed' && resolution.source === 'minute');
        if (shouldPersist) {
          await this.persistSignalPriceIfMissing(item.id, recommendationPrice);
          item.recommendationPrice = recommendationPrice;
        }

        return [item.id, recommendationPrice];
      }),
    );

    return new Map(entries.filter((entry): entry is [string, number] => entry != null));
  }

  /**
   * Handles persist signal price if missing in the market signal workflow.
   * @param id - Identifier for the target resource.
   * @param recommendationPrice - Input value for recommendation price.
   */
  private async persistSignalPriceIfMissing(id: string, recommendationPrice: number): Promise<void> {
    if (!Number.isFinite(recommendationPrice) || recommendationPrice <= 0) {
      return;
    }

    try {
      await MarketSignal.createQueryBuilder()
        .update(MarketSignal)
        .set({ recommendationPrice })
        .where('id = :id', { id })
        .andWhere('recommendation_price IS NULL')
        .execute();
    } catch (error) {
      this.logger.warn(
        this.i18n.t('logging.inference.marketSignal.recommendation_price_persist_failed', {
          args: { id },
        }),
        error,
      );
    }
  }

  /**
   * Builds minute lookup candidate set used in the market signal flow.
   * @param items - Collection of items used by the market signal flow.
   * @param mode - Input value for mode.
   * @returns Formatted string output for the operation.
   */
  private buildMinuteLookupCandidateSet(
    items: Array<Pick<MarketSignal, 'id' | 'createdAt'>>,
    mode: 'exact' | 'mixed' | 'approx',
  ): Set<string> {
    if (mode === 'exact') {
      return new Set(items.map((item) => item.id));
    }

    if (mode !== 'mixed') {
      return new Set();
    }

    const now = Date.now();
    return new Set(
      items
        .filter((item) => now - new Date(item.createdAt).getTime() <= 24 * 60 * 60 * 1000)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3)
        .map((item) => item.id),
    );
  }

  /**
   * Normalizes signal price at time for the market signal flow.
   * @param symbol - Asset symbol to process.
   * @param createdAt - Input value for created at.
   * @param marketData - Input value for market data.
   * @param allowMinuteLookup - Input value for allow minute lookup.
   * @returns Computed numeric value for the operation.
   */
  private async resolveSignalPriceAtTime(
    symbol: string,
    createdAt: Date,
    marketData?: KrwTickerDailyData | null,
    allowMinuteLookup = true,
  ): Promise<number | undefined> {
    const resolution = await this.resolveSignalPriceAtTimeWithSource(symbol, createdAt, marketData, allowMinuteLookup);
    return resolution.price;
  }

  /**
   * Normalizes signal price at time with source for the market signal flow.
   * @param symbol - Asset symbol to process.
   * @param createdAt - Input value for created at.
   * @param marketData - Input value for market data.
   * @param allowMinuteLookup - Input value for allow minute lookup.
   * @returns Asynchronous result produced by the market signal flow.
   */
  private async resolveSignalPriceAtTimeWithSource(
    symbol: string,
    createdAt: Date,
    marketData?: KrwTickerDailyData | null,
    allowMinuteLookup = true,
  ): Promise<SignalPriceResolution> {
    if (allowMinuteLookup) {
      const minutePrice = this.toPositiveNumber(await this.upbitService.getMinuteCandleAt(symbol, createdAt));
      if (minutePrice != null) {
        return { price: minutePrice, source: 'minute' };
      }
    }

    let marketDataRef = marketData;
    if (!marketDataRef) {
      try {
        marketDataRef = await this.upbitService.getTickerAndDailyData(symbol);
      } catch {
        marketDataRef = null;
      }
    }

    const currentPrice = this.toFiniteNumber(marketDataRef?.ticker?.last);
    const fallbackPrice = this.toPositiveNumber(
      this.resolveDailyFallbackPrice(marketDataRef?.candles1d || [], createdAt, currentPrice),
    );
    if (fallbackPrice != null) {
      return { price: fallbackPrice, source: 'fallback' };
    }

    return { source: 'none' };
  }

  /**
   * Normalizes daily fallback price for the market signal flow.
   * @param candles1d - Input value for candles1d.
   * @param createdAt - Input value for created at.
   * @param currentPrice - Input value for current price.
   * @returns Computed numeric value for the operation.
   */
  private resolveDailyFallbackPrice(candles1d: number[][], createdAt: Date, currentPrice?: number): number | undefined {
    if (candles1d.length < 1) {
      return currentPrice;
    }

    const recDateStr = new Date(createdAt).toISOString().slice(0, 10);
    const candleSameDay = candles1d.find((candle) => new Date(candle[0]).toISOString().slice(0, 10) === recDateStr);

    if (candleSameDay && candleSameDay.length >= 5) {
      return Number(candleSameDay[4]);
    }

    const lastCandle = candles1d[candles1d.length - 1];
    if (lastCandle && lastCandle.length >= 5) {
      return Number(lastCandle[4]);
    }

    return currentPrice;
  }

  /**
   * Normalizes finite number for the market signal flow.
   * @param value - Input value for value.
   * @returns Computed numeric value for the operation.
   */
  private toFiniteNumber(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  /**
   * Normalizes positive number for the market signal flow.
   * @param value - Input value for value.
   * @returns Computed numeric value for the operation.
   */
  private toPositiveNumber(value: unknown): number | undefined {
    const parsed = this.toFiniteNumber(value);
    if (parsed == null || parsed <= 0) {
      return undefined;
    }
    return parsed;
  }

  /**
   * Retrieves market validation badge map safe for the market signal flow.
   * @param ids - Identifier for the target resource.
   * @returns Result produced by the market signal flow.
   */
  private async getMarketValidationBadgeMapSafe(ids: string[]) {
    try {
      return await this.allocationAuditService.getMarketValidationBadgeMap(ids);
    } catch (error) {
      this.logger.warn(this.i18n.t('logging.inference.marketSignal.validation_badges_load_failed'), error);
      return new Map();
    }
  }

  /**
   * Normalizes market signals for the market signal flow.
   * @param recommendations - Input value for recommendations.
   * @param allowedSymbols - Asset symbol to process.
   * @returns Computed numeric value for the operation.
   */
  private normalizeMarketSignals(
    recommendations: Array<{
      symbol: string;
      weight: number;
      confidence: number;
      cashWeight: number;
      regime: 'risk_on' | 'neutral' | 'risk_off';
      riskFlags: string[];
      reason: string;
    }> | null,
    allowedSymbols?: string[],
  ): Array<{
    symbol: string;
    weight: number;
    confidence: number;
    cashWeight: number;
    regime: 'risk_on' | 'neutral' | 'risk_off';
    riskFlags: string[];
    reason: string;
  }> {
    if (!Array.isArray(recommendations)) {
      return [];
    }

    const allowedSet =
      Array.isArray(allowedSymbols) && allowedSymbols.length > 0
        ? new Set(allowedSymbols.map((symbol) => symbol.toUpperCase()))
        : null;

    return recommendations.flatMap((recommendation) => {
      const normalizedSymbol = normalizeKrwSymbol(recommendation?.symbol);
      if (!normalizedSymbol) {
        this.logger.warn(
          this.i18n.t('logging.inference.marketSignal.invalid_symbol_skipped', {
            args: { symbol: recommendation?.symbol ?? 'unknown' },
          }),
        );
        return [];
      }

      if (allowedSet && !allowedSet.has(normalizedSymbol)) {
        this.logger.warn(
          this.i18n.t('logging.inference.marketSignal.out_of_market_symbol_skipped', {
            args: { symbol: normalizedSymbol },
          }),
        );
        return [];
      }

      const weight = Number(recommendation.weight);
      const confidence = Number(recommendation.confidence);
      const cashWeight = Number(recommendation.cashWeight);
      const regime =
        recommendation.regime === 'risk_on' || recommendation.regime === 'risk_off' ? recommendation.regime : 'neutral';

      if (!Number.isFinite(weight) || !Number.isFinite(confidence) || !Number.isFinite(cashWeight)) {
        return [];
      }

      return [
        {
          symbol: normalizedSymbol,
          weight: Math.max(0, Math.min(1, weight)),
          confidence: Math.max(0, Math.min(1, confidence)),
          cashWeight: Math.max(0, Math.min(1, cashWeight)),
          regime,
          riskFlags: Array.isArray(recommendation.riskFlags)
            ? recommendation.riskFlags.filter((item): item is string => typeof item === 'string').slice(0, 10)
            : [],
          reason: recommendation.reason,
        },
      ];
    });
  }
}
