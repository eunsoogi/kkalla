import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

import { OHLCV } from 'ccxt';
import { I18nService } from 'nestjs-i18n';
import { ChatCompletionMessageParam, ResponseFormatJSONSchema } from 'openai/resources/index.mjs';

import { Category } from '@/modules/category/category.enum';
import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { RetryOptions } from '../error/error.interface';
import { ErrorService } from '../error/error.service';
import { CompactFeargreed } from '../feargreed/feargreed.interface';
import { FeargreedService } from '../feargreed/feargreed.service';
import { CompactNews } from '../news/news.interface';
import { NewsService } from '../news/news.service';
import { OpenaiService } from '../openai/openai.service';
import { Permission } from '../permission/permission.enum';
import { SequenceService } from '../sequence/sequence.service';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../user/entities/user.entity';
import { Inference } from './entities/inference.entity';
import { INFERENCE_CONFIG, INFERENCE_MODEL, INFERENCE_PROMPT, INFERENCE_RESPONSE_SCHEMA } from './inference.config';
import {
  CandleRequest,
  InferenceData,
  InferenceFilter,
  InferenceItem,
  InferenceMessageRequest,
  RecentInferenceRequest,
  RecentInferenceResult,
} from './inference.interface';

@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly errorService: ErrorService,
    private readonly sequenceService: SequenceService,
    private readonly openaiService: OpenaiService,
    private readonly upbitService: UpbitService,
    private readonly newsService: NewsService,
    private readonly feargreedService: FeargreedService,
  ) {}

  private async buildMessages(request: InferenceMessageRequest): Promise<ChatCompletionMessageParam[]> {
    const messages: ChatCompletionMessageParam[] = [];

    // Add system prompt
    this.addMessage(messages, 'system', INFERENCE_PROMPT);

    // Add news data
    const news = await this.fetchNewsData(request);
    if (news) {
      this.addMessagePair(messages, 'prompt.input.news', news);
    }

    const [symbol] = request.ticker.split('/');

    // Add ticker
    this.addMessagePair(messages, 'prompt.input.ticker', request.ticker);

    // Add candle data
    const timeframes = ['1d', '4h', '1h', '15m'];

    for (const timeframe of timeframes) {
      const candleData = await this.fetchCandleData({
        ticker: request.ticker,
        timeframe,
        limit: request.candles[timeframe],
      });

      if (candleData.length > 0) {
        this.addMessagePair(messages, 'prompt.input.candle', candleData, {
          args: { timeframe: this.i18n.t(`prompt.input.timeframe.${timeframe}`) },
        });
      }
    }

    // Add fear & greed data
    const feargreed = await this.fetchFearGreedData(symbol);
    if (feargreed) {
      this.addMessagePair(messages, 'prompt.input.feargreed', feargreed);
    }

    // Add previous inferences
    const recentInferences = await this.getRecentResult({
      ticker: request.ticker,
      createdAt: new Date(Date.now() - request.recentDateLimit),
      count: request.recentLimit,
    });
    if (recentInferences.length > 0) {
      this.addMessagePair(messages, 'prompt.input.recent', recentInferences);
    }

    this.logger.debug(messages);

    return messages;
  }

  private async fetchNewsData(request: InferenceMessageRequest): Promise<CompactNews[]> {
    this.logger.log(this.i18n.t('logging.news.loading', { args: request }));

    const news = await this.newsService.getCompactNews({
      type: this.newsService.getNewsType(request.category),
      limit: request.newsLimit,
      importanceLower: request.newsImportanceLower,
      skip: true,
    });

    return news;
  }

  private async fetchFearGreedData(): Promise<CompactFeargreed> {
    this.logger.log(this.i18n.t('logging.feargreed.loading'));

    const feargreed = await this.feargreedService.getCompactFeargreed();

    return feargreed;
  }

  private async fetchCandleData(request: CandleRequest): Promise<OHLCV[]> {
    this.logger.log(
      this.i18n.t('logging.upbit.candle.loading', {
        args: {
          ticker: request.ticker,
          timeframe: this.i18n.t(`prompt.input.timeframe.${request.timeframe}`),
        },
      }),
    );

    const candles = await this.upbitService.getCandles(request);

    return candles;
  }

  private addMessage(
    messages: ChatCompletionMessageParam[],
    role: 'system' | 'assistant' | 'user',
    content: string,
  ): void {
    messages.push({ role, content });
  }

  private addMessagePair(messages: ChatCompletionMessageParam[], promptKey: string, data: any, args?: any): void {
    this.addMessage(messages, 'system', this.i18n.t(promptKey, args));
    this.addMessage(messages, 'user', JSON.stringify(data));
  }

  public getResponseFormat(): ResponseFormatJSONSchema {
    return {
      type: 'json_schema',
      json_schema: {
        strict: true,
        name: InferenceService.name,
        schema: INFERENCE_RESPONSE_SCHEMA,
      },
    };
  }

  public async requestAPI(request: InferenceMessageRequest, retryOptions?: RetryOptions): Promise<InferenceData> {
    const messages = await this.buildMessages(request);
    const responseFormat = this.getResponseFormat();
    const client = await this.openaiService.getServerClient();

    this.logger.log(this.i18n.t('logging.inference.loading', { args: request }));

    const inferenceData = await this.errorService.retry(async () => {
      const response = await client.chat.completions.create({
        model: INFERENCE_MODEL,
        max_completion_tokens: INFERENCE_CONFIG.maxCompletionTokens,
        response_format: responseFormat,
        messages,
        stream: false,
      });

      this.logger.debug(response);

      return JSON.parse(response.choices[0].message.content);
    }, retryOptions);

    return inferenceData;
  }

  public async request(item: InferenceItem): Promise<Inference> {
    this.logger.log(this.i18n.t('logging.inference.start', { args: item }));

    try {
      const data = await this.requestAPI({
        ...INFERENCE_CONFIG.message,
        ticker: item.ticker,
        category: item.category,
      });

      const inference = await this.create({
        ...data,
        category: item.category,
        hasStock: item.hasStock,
      });

      return inference;
    } catch (error) {
      this.logger.error(this.i18n.t('logging.inference.fail', { args: item }), error);
      return null;
    }
  }

  private getCategoryPermission(category: Category): Permission {
    const permissionMap: Record<Category, Permission> = {
      [Category.NASDAQ]: Permission.VIEW_INFERENCE_NASDAQ,
      [Category.COIN_MAJOR]: Permission.VIEW_INFERENCE_COIN_MAJOR,
      [Category.COIN_MINOR]: Permission.VIEW_INFERENCE_COIN_MINOR,
    };

    const permission = permissionMap[category];
    if (!permission) {
      throw new Error(
        this.i18n.t('logging.category.unknown', {
          args: { category },
        }),
      );
    }

    return permission;
  }

  public validateCategoryPermission(user: User, category: Category): boolean {
    const userPermissions = user.roles.flatMap((role) => role.permissions || []);
    const requiredPermission = this.getCategoryPermission(category);
    return userPermissions.includes(requiredPermission);
  }

  public async create(data: InferenceData): Promise<Inference> {
    const inference = new Inference();

    // 줄바꿈 문자를 공백으로 변경
    if (data.reason) {
      data.reason = data.reason.replace(/[\r\n]+/g, ' ');
    }

    Object.assign(inference, data);
    inference.seq = await this.sequenceService.getNextSequence();

    return inference.save();
  }

  public async getRecentResult(request: RecentInferenceRequest): Promise<RecentInferenceResult[]> {
    const inferences = await Inference.getRecent(request);

    return inferences.map((inference) => ({
      timestamp: inference.updatedAt,
      rate: inference.rate,
    }));
  }

  public async paginate(user: User, request: ItemRequest & InferenceFilter): Promise<PaginatedItem<Inference>> {
    if (!this.validateCategoryPermission(user, request.category)) {
      throw new ForbiddenException(this.i18n.t('logging.category.access_denied'));
    }

    return Inference.paginate(request);
  }

  public async cursor(
    user: User,
    request: CursorRequest<string> & InferenceFilter,
  ): Promise<CursorItem<Inference, string>> {
    if (!this.validateCategoryPermission(user, request.category)) {
      throw new ForbiddenException(this.i18n.t('logging.category.access_denied'));
    }

    return Inference.cursor(request);
  }
}
