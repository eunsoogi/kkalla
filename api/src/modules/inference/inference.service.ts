import { Injectable, Logger } from '@nestjs/common';

import * as Handlebars from 'handlebars';
import { I18nService } from 'nestjs-i18n';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs';

import { ErrorService } from '@/modules/error/error.service';
import { CompactFeargreed } from '@/modules/feargreed/feargreed.interface';
import { FeargreedService } from '@/modules/feargreed/feargreed.service';
import { FeatureService } from '@/modules/feature/feature.service';
import { CursorItem, PaginatedItem } from '@/modules/item/item.interface';
import { NewsTypes } from '@/modules/news/news.enum';
import { CompactNews } from '@/modules/news/news.interface';
import { NewsService } from '@/modules/news/news.service';
import { NotifyService } from '@/modules/notify/notify.service';
import { OpenaiService } from '@/modules/openai/openai.service';

import { MarketFeatures } from '../upbit/upbit.interface';
import { BalanceRecommendationDto } from './dto/balance-recommendation.dto';
import { GetRecommendationsCursorDto } from './dto/get-recommendations-cursor.dto';
import { GetRecommendationsPaginationDto } from './dto/get-recommendations-pagination.dto';
import { MarketRecommendationDto } from './dto/market-recommendation.dto';
import { BalanceRecommendation } from './entities/balance-recommendation.entity';
import { MarketRecommendation } from './entities/market-recommendation.entity';
import {
  BalanceRecommendationData,
  MarketRecommendationData,
  MarketRecommendationResponse,
  RecommendationItem,
} from './inference.interface';
import {
  UPBIT_BALANCE_RECOMMENDATION_CONFIG,
  UPBIT_BALANCE_RECOMMENDATION_PROMPT,
  UPBIT_BALANCE_RECOMMENDATION_RESPONSE_SCHEMA,
} from './prompts/balance-recommendation.prompt';
import {
  MARKET_DATA_TEMPLATE,
  UPBIT_MARKET_DATA_LEGEND,
  UPBIT_MARKET_RECOMMENDATION_CONFIG,
  UPBIT_MARKET_RECOMMENDATION_PROMPT,
  UPBIT_MARKET_RECOMMENDATION_RESPONSE_SCHEMA,
} from './prompts/market-recommendation.prompt';

@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly newsService: NewsService,
    private readonly feargreedService: FeargreedService,
    private readonly openaiService: OpenaiService,
    private readonly featureService: FeatureService,
    private readonly errorService: ErrorService,
    private readonly notifyService: NotifyService,
  ) {}

  /**
   * 전체 KRW 마켓에서 상위 10개 종목 추천
   * @returns 상위 10개 종목 추천 결과
   */
  public async marketRecommendation(symbols?: string[]): Promise<MarketRecommendationResponse> {
    this.logger.log(this.i18n.t('logging.inference.marketRecommendation.start'));

    // 메시지 빌드
    this.logger.log(this.i18n.t('logging.inference.marketRecommendation.build_msg_start'));

    const messages = await this.errorService.retryWithFallback(() => this.buildMarketRecommendationMessages(symbols));

    this.logger.log(this.i18n.t('logging.inference.marketRecommendation.build_msg_complete'));

    // 배치 요청 처리
    this.logger.log(this.i18n.t('logging.inference.marketRecommendation.batch_start'));

    const result = await this.errorService.retryWithFallback(async () => {
      const requestConfig = {
        ...UPBIT_MARKET_RECOMMENDATION_CONFIG,
        response_format: {
          type: 'json_schema' as const,
          json_schema: {
            name: 'market_recommendation',
            strict: true,
            schema: UPBIT_MARKET_RECOMMENDATION_RESPONSE_SCHEMA,
          },
        },
      };

      const batchRequest = this.openaiService.createBatchRequest('market-recommendation', messages, requestConfig);
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

    this.logger.log(this.i18n.t('logging.inference.marketRecommendation.batch_complete'));

    // 결과 저장
    if (result.recommendations?.length > 0) {
      await Promise.all(
        result.recommendations.map((recommendation) => this.saveMarketRecommendation(recommendation, result.batchId)),
      );

      // 추천 결과 전송
      const recommendSymbols = result.recommendations.map((rec) => rec.symbol).join(', ');
      const message = this.i18n.t('notify.marketRecommendation.completed', {
        args: {
          count: result.recommendations.length,
          symbols: recommendSymbols,
        },
      });

      await this.notifyService.notifyServer(message);
    }

    this.logger.log(this.i18n.t('logging.inference.marketRecommendation.complete'));
    return result;
  }

  /**
   * 선택된 종목들의 매수 비율 추천
   * @param items 분석할 종목 목록 (hasStock 정보 포함)
   * @returns 각 종목별 매수 비율 추천 결과
   */
  public async balanceRecommendation(items: RecommendationItem[]): Promise<BalanceRecommendationData[]> {
    this.logger.log(this.i18n.t('logging.inference.balanceRecommendation.start', { args: { count: items.length } }));

    // 각 종목에 대한 실시간 API 호출을 병렬로 처리
    const results = await Promise.all(
      items.map(async (item) => {
        return await this.errorService.retryWithFallback(async () => {
          const { ...config } = UPBIT_BALANCE_RECOMMENDATION_CONFIG;
          const messages = await this.buildBalanceRecommendationMessages(item.ticker);
          const requestConfig = {
            response_format: {
              type: 'json_schema' as const,
              json_schema: {
                name: 'balance_recommendation',
                strict: true,
                schema: UPBIT_BALANCE_RECOMMENDATION_RESPONSE_SCHEMA,
              },
            },
            ...config,
          };

          // 실시간 API 호출
          const completion = await this.openaiService.createChatCompletion(messages, requestConfig);
          const responseData = JSON.parse(completion.choices[0].message.content);

          // 추론 결과와 아이템 병합
          return {
            ...responseData,
            category: item?.category,
            hasStock: item?.hasStock || false,
          };
        });
      }),
    );

    // 결과 저장
    const successResults = results.filter((result) => !result.error);
    if (successResults.length > 0) {
      await Promise.all(successResults.map((recommendation) => this.saveBalanceRecommendation(recommendation)));
    }

    this.logger.log(this.i18n.t('logging.inference.balanceRecommendation.complete'));
    return results;
  }

  /**
   * 마켓 분석 메시지 빌드
   */
  private async buildMarketRecommendationMessages(symbols?: string[]): Promise<ChatCompletionMessageParam[]> {
    const messages: ChatCompletionMessageParam[] = [];

    // 시스템 프롬프트 추가
    this.addMessage(messages, 'system', UPBIT_MARKET_RECOMMENDATION_PROMPT);

    // 뉴스 데이터 추가
    const news = await this.fetchNewsData();
    if (news && news.length > 0) {
      this.addMessagePair(messages, 'prompt.input.news', news);
    }

    // 공포탐욕지수 추가
    const feargreed = await this.fetchFearGreedData();
    if (feargreed) {
      this.addMessagePair(messages, 'prompt.input.feargreed', feargreed);
    }

    // 종목 feature 데이터 추가
    const marketFeatures = await this.featureService.extractAllKrwMarketFeatures(symbols);
    const marketData = this.formatMarketData(marketFeatures);
    this.addMessage(messages, 'user', `${UPBIT_MARKET_DATA_LEGEND}\n\n${marketData}`);

    return messages;
  }

  /**
   * 포트폴리오 분석 메시지 빌드
   */
  private async buildBalanceRecommendationMessages(symbol: string): Promise<ChatCompletionMessageParam[]> {
    const messages: ChatCompletionMessageParam[] = [];

    // 시스템 프롬프트 추가
    this.addMessage(messages, 'system', UPBIT_BALANCE_RECOMMENDATION_PROMPT);

    // 뉴스 데이터 추가
    const news = await this.fetchNewsData();
    if (news && news.length > 0) {
      this.addMessagePair(messages, 'prompt.input.news', news);
    }

    // 공포탐욕지수 추가
    const feargreed = await this.fetchFearGreedData();
    if (feargreed) {
      this.addMessagePair(messages, 'prompt.input.feargreed', feargreed);
    }

    // 이전 추론 추가
    const recentRecommendations = await this.fetchRecentRecommendations(symbol);
    if (recentRecommendations.length > 0) {
      this.addMessagePair(messages, 'prompt.input.recent', recentRecommendations);
    }

    // 개별 종목 feature 데이터 추가
    const marketFeatures = await this.featureService.extractMarketFeatures(symbol);
    const marketData = this.formatMarketData([marketFeatures]);
    this.addMessage(messages, 'user', `${UPBIT_MARKET_DATA_LEGEND}\n\n${marketData}`);

    return messages;
  }

  /**
   * 뉴스 데이터 가져오기
   */
  private async fetchNewsData(): Promise<CompactNews[]> {
    const operation = () =>
      this.newsService.getCompactNews({
        type: NewsTypes.COIN,
        limit: 100,
        importanceLower: 1,
        skip: false,
      });

    try {
      return await this.errorService.retryWithFallback(operation);
    } catch (error) {
      this.logger.error(this.i18n.t('logging.news.load_failed'), error);
      return [];
    }
  }

  /**
   * 공포탐욕지수 데이터 가져오기
   */
  private async fetchFearGreedData(): Promise<CompactFeargreed | null> {
    const operation = () => this.feargreedService.getCompactFeargreed();

    try {
      return await this.errorService.retryWithFallback(operation);
    } catch (error) {
      this.logger.error(this.i18n.t('logging.feargreed.load_failed'), error);
      return null;
    }
  }

  /**
   * 이전 추론 데이터 가져오기
   */
  private async fetchRecentRecommendations(symbol: string): Promise<BalanceRecommendation[]> {
    const operation = () =>
      BalanceRecommendation.getRecent({
        ticker: symbol,
        createdAt: new Date(Date.now() - UPBIT_BALANCE_RECOMMENDATION_CONFIG.message.recentDateLimit),
        count: UPBIT_BALANCE_RECOMMENDATION_CONFIG.message.recent,
      });

    try {
      return await this.errorService.retryWithFallback(operation);
    } catch (error) {
      this.logger.error(this.i18n.t('logging.inference.recent_recommendations_failed'), error);
      return [];
    }
  }

  /**
   * 메시지 추가 헬퍼
   */
  private addMessage(
    messages: ChatCompletionMessageParam[],
    role: 'system' | 'assistant' | 'user',
    content: string,
  ): void {
    messages.push({ role, content });
  }

  /**
   * 메시지 페어 추가 헬퍼 (i18n 지원)
   */
  private addMessagePair(messages: ChatCompletionMessageParam[], promptKey: string, data: any, args?: any): void {
    const content = String(this.i18n.t(promptKey, args));
    const dataString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    this.addMessage(messages, 'user', content);
    this.addMessage(messages, 'user', dataString);
  }

  /**
   * 마켓 특성 데이터를 압축 형태로 포맷팅
   */
  private formatMarketData(marketFeatures: MarketFeatures[]): string {
    const template = Handlebars.compile(MARKET_DATA_TEMPLATE);

    return marketFeatures
      .filter((feature) => feature && feature.symbol)
      .map((feature) => {
        const context = {
          symbol: feature.symbol,
          price: feature.price ?? 0,
          changePercent: feature.priceChangePercent24h ?? 0,
          volumeM: (feature.volume24h ?? 0) / 1000000,
          marketCapM: (feature.marketCap ?? 0) / 1000000,
          rsi14: feature.rsi14 ?? 0,
          stochK: feature.stochastic?.percentK ?? 0,
          stochD: feature.stochastic?.percentD ?? 0,
          williamsR: feature.williamsR ?? 0,
          mfi: feature.mfi ?? 0,
          cci: feature.cci ?? 0,
          macdValue: feature.macd?.macd ?? 0,
          macdSignal: feature.macd?.signal ?? 0,
          macdHist: feature.macd?.histogram ?? 0,
          sma20: feature.sma?.sma20 ?? 0,
          sma50: feature.sma?.sma50 ?? 0,
          sma200: feature.sma?.sma200 ?? 0,
          bbUpper: feature.bollingerBands?.upper ?? 0,
          bbMiddle: feature.bollingerBands?.middle ?? 0,
          bbLower: feature.bollingerBands?.lower ?? 0,
          bbPercent: feature.bollingerBands?.percentB ?? 0,
          atr14: feature.atr?.atr14 ?? 0,
          volatility: feature.volatility ?? 0,
          vwap: feature.vwap ?? 0,
          obvTrend: feature.obv?.trend ?? 0,
          obvSignal: feature.obv?.signal || 'neutral',
          support1: feature.supportResistance?.support1 ?? 0,
          resistance1: feature.supportResistance?.resistance1 ?? 0,
          trendType: feature.patterns?.trend || 'sideways',
          trendStrength: feature.patterns?.strength ?? 0,
          divergence: feature.patterns?.divergence || 'none',
        };
        return template(context);
      })
      .join('\n');
  }

  public async paginateMarketRecommendations(
    params: GetRecommendationsPaginationDto,
  ): Promise<PaginatedItem<MarketRecommendationDto>> {
    return MarketRecommendation.paginate(params);
  }

  public async cursorMarketRecommendations(
    params: GetRecommendationsCursorDto,
  ): Promise<CursorItem<MarketRecommendationDto, string>> {
    const cursorResult = await MarketRecommendation.cursor(params);
    const items = cursorResult.items.map((entity) => ({
      id: entity.id,
      symbol: entity.symbol,
      weight: entity.weight,
      reason: entity.reason,
      confidence: entity.confidence,
      batchId: entity.batchId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    }));

    return {
      ...cursorResult,
      items,
    };
  }

  public async paginateBalanceRecommendations(
    params: GetRecommendationsPaginationDto,
  ): Promise<PaginatedItem<BalanceRecommendationDto>> {
    const paginatedResult = await BalanceRecommendation.paginate(params);
    const items = paginatedResult.items.map((entity) => ({
      id: entity.id,
      seq: entity.seq,
      ticker: entity.ticker,
      category: entity.category,
      rate: entity.rate,
      reason: entity.reason,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    }));

    return {
      ...paginatedResult,
      items,
    };
  }

  public async cursorBalanceRecommendations(
    params: GetRecommendationsCursorDto,
  ): Promise<CursorItem<BalanceRecommendationDto, string>> {
    const cursorResult = await BalanceRecommendation.cursor(params);
    const items = cursorResult.items.map((entity) => ({
      id: entity.id,
      seq: entity.seq,
      ticker: entity.ticker,
      category: entity.category,
      rate: entity.rate,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    }));

    return {
      ...cursorResult,
      items,
    };
  }

  public async saveMarketRecommendation(
    recommendation: MarketRecommendationData,
    batchId: string,
  ): Promise<MarketRecommendation> {
    const marketRecommendation = new MarketRecommendation();

    Object.assign(marketRecommendation, recommendation);
    marketRecommendation.batchId = batchId;

    return marketRecommendation.save();
  }

  public async saveBalanceRecommendation(recommendation: BalanceRecommendationData): Promise<BalanceRecommendation> {
    const balanceRecommendation = new BalanceRecommendation();
    Object.assign(balanceRecommendation, recommendation);
    return balanceRecommendation.save();
  }
}
