import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';
import OpenAI from 'openai';
import { ChatCompletion, ChatCompletionMessageParam, ResponseFormatJSONSchema } from 'openai/resources/index.mjs';

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
import { CompactCandle } from '../upbit/upbit.interface';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../user/entities/user.entity';
import { Inference } from './entities/inference.entity';
import { INFERENCE_CONFIG, INFERENCE_MODEL, INFERENCE_PROMPT, INFERENCE_RESPONSE_SCHEMA } from './inference.config';
import { InferenceCategory } from './inference.enum';
import { InferenceData, InferenceFilter, InferenceItem, InferenceMessageRequest } from './inference.interface';

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
    const [symbol] = request.ticker.split('/');

    // Add system prompt
    this.addMessage(messages, 'system', INFERENCE_PROMPT);

    // Add news data
    const news = await this.fetchNewsData(request);
    this.addMessagePair(messages, 'prompt.input.news', news);

    // Add fear & greed data
    const feargreed = await this.fetchFearGreedData(symbol);
    this.addMessagePair(messages, 'prompt.input.feargreed', feargreed);

    // Add candle data
    const candles = await this.fetchCandleData(request);
    this.addMessagePair(messages, 'prompt.input.candle', candles);

    return messages;
  }

  private async fetchNewsData(request: InferenceMessageRequest): Promise<CompactNews[]> {
    this.logger.log(this.i18n.t('logging.news.loading', { args: request }));
    const news = await this.newsService.getCompactNews({
      type: this.newsService.getNewsType(request.category),
      limit: request.newsLimit,
      skip: true,
    });
    return news;
  }

  private async fetchFearGreedData(symbol: string): Promise<CompactFeargreed> {
    this.logger.log(this.i18n.t('logging.feargreed.loading', { args: { symbol } }));
    const feargreed = await this.feargreedService.getCompactFeargreed(symbol);
    return feargreed;
  }

  private async fetchCandleData(request: InferenceMessageRequest): Promise<CompactCandle> {
    this.logger.log(this.i18n.t('logging.upbit.candle.loading', { args: request }));
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

  private addMessagePair(messages: ChatCompletionMessageParam[], promptKey: string, data: any): void {
    this.addMessage(messages, 'assistant', this.i18n.t(promptKey));
    this.addMessage(messages, 'user', JSON.stringify(data || '{}'));
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

  public async requestInference(request: InferenceMessageRequest, retryOptions?: RetryOptions): Promise<InferenceData> {
    const messages = await this.buildMessages(request);
    const responseFormat = this.getResponseFormat();
    const client = await this.openaiService.getServerClient();

    this.logger.log(this.i18n.t('logging.inference.loading', { args: request }));

    const response = await this.errorService.retry(
      () => this.createChatCompletion(client, messages, responseFormat),
      retryOptions,
    );
    const inferenceData = JSON.parse(response.choices[0].message?.content || '{}');

    return inferenceData;
  }

  private async createChatCompletion(
    client: OpenAI,
    messages: ChatCompletionMessageParam[],
    responseFormat: ResponseFormatJSONSchema,
  ): Promise<ChatCompletion> {
    return client.chat.completions.create({
      model: INFERENCE_MODEL,
      max_completion_tokens: INFERENCE_CONFIG.maxCompletionTokens,
      temperature: INFERENCE_CONFIG.temperature,
      top_p: INFERENCE_CONFIG.topP,
      presence_penalty: INFERENCE_CONFIG.presencePenalty,
      frequency_penalty: INFERENCE_CONFIG.frequencyPenalty,
      response_format: responseFormat,
      messages,
      stream: false,
    });
  }

  public async getInference(item: InferenceItem): Promise<Inference> {
    this.logger.log(this.i18n.t('logging.inference.start', { args: item }));

    try {
      const data = await this.requestInference({
        ...INFERENCE_CONFIG.message,
        ticker: item.ticker,
        category: item.category,
      });

      return this.create({
        ...data,
        category: item.category,
      });
    } catch (error) {
      this.logger.error(this.i18n.t('logging.inference.fail', { args: item }), error);
      return null;
    }
  }

  private getCategoryPermission(category: InferenceCategory): Permission {
    const permissionMap: Record<InferenceCategory, Permission> = {
      [InferenceCategory.NASDAQ]: Permission.VIEW_INFERENCE_NASDAQ,
      [InferenceCategory.COIN_MAJOR]: Permission.VIEW_INFERENCE_COIN_MAJOR,
      [InferenceCategory.COIN_MINOR]: Permission.VIEW_INFERENCE_COIN_MINOR,
    };

    const permission = permissionMap[category];
    if (!permission) {
      throw new Error(
        this.i18n.t('logging.inference.unknown_category', {
          args: { category },
        }),
      );
    }

    return permission;
  }

  public validateCategoryPermission(user: User, category: InferenceCategory): boolean {
    const userPermissions = user.roles.flatMap((role) => role.permissions || []);
    const requiredPermission = this.getCategoryPermission(category);
    return userPermissions.includes(requiredPermission);
  }

  public async create(data: InferenceData): Promise<Inference> {
    const inference = new Inference();

    Object.assign(inference, data);
    inference.seq = await this.sequenceService.getNextSequence();

    return inference.save();
  }

  public async paginate(user: User, request: ItemRequest & InferenceFilter): Promise<PaginatedItem<Inference>> {
    if (!this.validateCategoryPermission(user, request.category)) {
      throw new ForbiddenException(this.i18n.t('logging.inference.category_access_denied'));
    }

    return Inference.paginate(request);
  }

  public async cursor(
    user: User,
    request: CursorRequest<string> & InferenceFilter,
  ): Promise<CursorItem<Inference, string>> {
    if (!this.validateCategoryPermission(user, request.category)) {
      throw new ForbiddenException(this.i18n.t('logging.inference.category_access_denied'));
    }

    return Inference.cursor(request);
  }
}
