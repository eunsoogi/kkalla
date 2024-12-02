import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';
import OpenAI from 'openai';
import { ChatCompletion, ChatCompletionMessageParam, ResponseFormatJSONSchema } from 'openai/resources/index.mjs';

import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { DecisionService } from '../decision/decision.service';
import { CompactFeargreed } from '../feargreed/feargreed.interface';
import { FeargreedService } from '../feargreed/feargreed.service';
import { NewsTypes } from '../news/news.enum';
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
import { InferenceData, InferenceFilter, InferenceMessageRequest, RetryOptions } from './inference.interface';

@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly sequenceService: SequenceService,
    private readonly decisionService: DecisionService,
    private readonly openaiService: OpenaiService,
    private readonly upbitService: UpbitService,
    private readonly newsService: NewsService,
    private readonly feargreedService: FeargreedService,
  ) {}

  private addMessage(messages: ChatCompletionMessageParam[], role: 'system' | 'assistant' | 'user', content: string) {
    messages.push({ role, content });
  }

  public async getMessageParams(request: InferenceMessageRequest): Promise<ChatCompletionMessageParam[]> {
    const messages: ChatCompletionMessageParam[] = [];

    this.addMessage(messages, 'system', INFERENCE_PROMPT);

    this.logger.log(this.i18n.t('logging.news.loading'));
    const news: CompactNews[] = await this.newsService.getCompactNews({
      type: NewsTypes.COIN,
      limit: request.newsLimit,
      skip: true,
    });
    this.logger.debug(news);
    this.addMessage(messages, 'assistant', this.i18n.t('prompt.input.news'));
    this.addMessage(messages, 'user', JSON.stringify(news || '{}'));

    this.logger.log(this.i18n.t('logging.feargreed.loading'));
    const feargreed: CompactFeargreed = await this.feargreedService.getCompactFeargreed(request.symbol);
    this.logger.debug(feargreed);
    this.addMessage(messages, 'assistant', this.i18n.t('prompt.input.feargreed'));
    this.addMessage(messages, 'user', JSON.stringify(feargreed || '{}'));

    this.logger.log(this.i18n.t('logging.upbit.candle.loading', { args: request }));
    const candles: CompactCandle = await this.upbitService.getCandles(request);
    this.logger.debug(candles);
    this.addMessage(messages, 'assistant', this.i18n.t('prompt.input.candle'));
    this.addMessage(messages, 'user', JSON.stringify(candles || '{}'));

    return messages;
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

  public async infer(request: InferenceMessageRequest, retryOptions?: RetryOptions): Promise<InferenceData> {
    const messages: ChatCompletionMessageParam[] = await this.getMessageParams(request);
    const responseFormat: ResponseFormatJSONSchema = this.getResponseFormat();

    this.logger.log(this.i18n.t('logging.inference.loading'));

    const client: OpenAI = await this.openaiService.getServerClient();
    const response: ChatCompletion = await this.retry(
      () =>
        client.chat.completions.create({
          model: INFERENCE_MODEL,
          max_completion_tokens: INFERENCE_CONFIG.maxCompletionTokens,
          temperature: INFERENCE_CONFIG.temperature,
          top_p: INFERENCE_CONFIG.topP,
          presence_penalty: INFERENCE_CONFIG.presencePenalty,
          frequency_penalty: INFERENCE_CONFIG.frequencyPenalty,
          response_format: responseFormat,
          messages,
          stream: false,
        }),
      retryOptions,
    );

    this.logger.debug(response);

    const data: InferenceData = JSON.parse(response.choices[0].message?.content || '{}');

    return data;
  }

  private async retry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T> {
    const maxRetries = options?.maxRetries || 3;
    const retryDelay = options?.retryDelay || 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        this.logger.warn(
          this.i18n.t('logging.retry.attempt', {
            args: {
              attempt,
              maxRetries,
            },
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }

    throw new Error(this.i18n.t('logging.retry.failed'));
  }

  private getCategoryPermission(category: InferenceCategory): Permission {
    switch (category) {
      case InferenceCategory.NASDAQ:
        return Permission.VIEW_INFERENCE_NASDAQ;
      case InferenceCategory.COIN_MAJOR:
        return Permission.VIEW_INFERENCE_COIN_MAJOR;
      case InferenceCategory.COIN_MINOR:
        return Permission.VIEW_INFERENCE_COIN_MINOR;
      default:
        throw new Error(
          this.i18n.t('logging.inference.permission.unknown_category', {
            args: { category },
          }),
        );
    }
  }

  private validateCategoryPermission(user: User, category: InferenceCategory): boolean {
    const userPermissions = user.roles.flatMap((role) => role.permissions || []);
    const requiredPermission = this.getCategoryPermission(category);
    return userPermissions.includes(requiredPermission);
  }

  public async create(data: InferenceData): Promise<Inference> {
    const inference = new Inference();

    Object.assign(inference, data);
    inference.seq = await this.sequenceService.getNextSequence();
    inference.decisions = await Promise.all(data.decisions.map(async (item) => this.decisionService.create(item)));

    return inference.save();
  }

  public async paginate(user: User, request: ItemRequest & InferenceFilter): Promise<PaginatedItem<Inference>> {
    if (!this.validateCategoryPermission(user, request.category)) {
      throw new ForbiddenException(this.i18n.t('logging.inference.permission.category_access_denied'));
    }

    return Inference.paginate(request);
  }

  public async cursor(
    user: User,
    request: CursorRequest<string> & InferenceFilter,
  ): Promise<CursorItem<Inference, string>> {
    if (!this.validateCategoryPermission(user, request.category)) {
      throw new ForbiddenException(this.i18n.t('logging.inference.permission.category_access_denied'));
    }

    return Inference.cursor(request);
  }
}
