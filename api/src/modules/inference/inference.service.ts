import { Injectable, Logger } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';
import OpenAI from 'openai';
import { ChatCompletion, ChatCompletionMessageParam, ResponseFormatJSONSchema } from 'openai/resources/index.mjs';

import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { Feargreed } from '../feargreed/feargreed.interface';
import { FeargreedService } from '../feargreed/feargreed.service';
import { FirechartService } from '../firechart/firechart.service';
import { NewsTypes } from '../news/news.enum';
import { News } from '../news/news.interface';
import { NewsService } from '../news/news.service';
import { OpenaiService } from '../openai/openai.service';
import { Candle } from '../upbit/upbit.interface';
import { UpbitService } from '../upbit/upbit.service';
import { Inference } from './entities/inference.entity';
import { INFERENCE_CONFIG, INFERENCE_MODEL, INFERENCE_PROMPT, INFERENCE_RESPONSE_SCHEMA } from './inference.config';
import {
  InferenceData,
  InferenceFilter,
  InferenceItem,
  InferenceMessage,
  InferenceMessageRequest,
  RetryOptions,
} from './inference.interface';

@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly openaiService: OpenaiService,
    private readonly upbitService: UpbitService,
    private readonly newsService: NewsService,
    private readonly feargreedService: FeargreedService,
    private readonly firechartService: FirechartService,
  ) {}

  public async getMessage(request: InferenceMessageRequest): Promise<InferenceMessage> {
    this.logger.log(this.i18n.t('logging.upbit.candle.loading'));

    const candles: Candle[] = await this.upbitService.getCandles(request);

    this.logger.log(this.i18n.t('logging.news.loading'));

    const news: News[] = await this.newsService.getNews({
      type: NewsTypes.COIN,
      limit: request.newsLimit,
    });

    this.logger.log(this.i18n.t('logging.feargreed.loading'));

    const feargreed: Feargreed = await this.feargreedService.getFeargreed();

    this.logger.log(this.i18n.t('logging.firechart.loading'));

    const firechart: string = await this.firechartService.getFirechart();

    this.logger.log(this.i18n.t('logging.inference.loading'));

    const inferenceResult: PaginatedItem<Inference> = await this.paginate({
      page: 1,
      perPage: request.inferenceLimit,
    });

    const prevInferences: Inference[] = inferenceResult.items;

    const data: InferenceMessage = {
      candles,
      news,
      feargreed,
      firechart,
      prevInferences,
    };

    return data;
  }

  public getMessageParams(message: InferenceMessage): ChatCompletionMessageParam[] {
    return [
      {
        role: 'system',
        content: INFERENCE_PROMPT,
      },
      {
        role: 'user',
        content: JSON.stringify(message),
      },
    ];
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

  public async inference(request: InferenceMessageRequest, retryOptions?: RetryOptions): Promise<InferenceData> {
    const client: OpenAI = await this.openaiService.getServerClient();

    const message: InferenceMessage = await this.getMessage(request);

    const response: ChatCompletion = await this.retry(
      () =>
        client.chat.completions.create({
          model: INFERENCE_MODEL,
          max_completion_tokens: INFERENCE_CONFIG.maxCompletionTokens,
          temperature: INFERENCE_CONFIG.temperature,
          top_p: INFERENCE_CONFIG.topP,
          presence_penalty: INFERENCE_CONFIG.presencePenalty,
          frequency_penalty: INFERENCE_CONFIG.frequencyPenalty,
          messages: this.getMessageParams(message),
          response_format: this.getResponseFormat(),
          stream: false,
        }),
      retryOptions,
    );

    this.logger.log(response);

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

  public async create(data: InferenceItem): Promise<Inference> {
    const inference = new Inference();
    Object.assign(inference, data);
    return inference.save();
  }

  public async paginate(request: ItemRequest & InferenceFilter): Promise<PaginatedItem<Inference>> {
    return Inference.paginate(request);
  }

  public async cursor(request: CursorRequest<string> & InferenceFilter): Promise<CursorItem<Inference, string>> {
    return Inference.cursor(request);
  }
}
