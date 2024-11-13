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
import { User } from '../user/entities/user.entity';
import { Inference } from './entities/inference.entity';
import { INFERENCE_CONFIG, INFERENCE_MODEL, INFERENCE_PROMPT, INFERENCE_RESPONSE_SCHEMA } from './inference.config';
import { InferenceData, InferenceItem, InferenceMessage, InferenceMessageRequest } from './inference.interface';

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

  public async getMessage(user: User, request: InferenceMessageRequest): Promise<InferenceMessage> {
    this.logger.log(this.i18n.t('logging.upbit.candle.loading'));

    const candles: Candle[] = await this.upbitService.getCandles(user, request);

    this.logger.log(this.i18n.t('logging.news.loading'));

    const news: News[] = await this.newsService.get({
      type: NewsTypes.COIN,
      limit: request.newsLimit,
    });

    this.logger.log(this.i18n.t('logging.feargreed.loading'));

    const feargreed: Feargreed = await this.feargreedService.get();

    this.logger.log(this.i18n.t('logging.firechart.loading'));

    const firechart: string = await this.firechartService.getFirechart();

    this.logger.log(this.i18n.t('logging.inference.loading'));

    const inferenceResult: PaginatedItem<Inference> = await this.paginate(user, {
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

  public async inference(user: User, request: InferenceMessageRequest): Promise<InferenceData> {
    const client: OpenAI = await this.openaiService.getClient(user);

    const message: InferenceMessage = await this.getMessage(user, request);

    const response: ChatCompletion = await client.chat.completions.create({
      model: INFERENCE_MODEL,
      max_completion_tokens: INFERENCE_CONFIG.maxCompletionTokens,
      temperature: INFERENCE_CONFIG.temperature,
      top_p: INFERENCE_CONFIG.topP,
      presence_penalty: INFERENCE_CONFIG.presencePenalty,
      frequency_penalty: INFERENCE_CONFIG.frequencyPenalty,
      messages: this.getMessageParams(message),
      response_format: this.getResponseFormat(),
      stream: false,
    });

    this.logger.log(response);

    const data: InferenceData = JSON.parse(response.choices[0].message?.content || '{}');

    return data;
  }

  public async create(user: User, data: InferenceItem): Promise<Inference> {
    const inference = new Inference();

    inference.user = user;
    Object.assign(inference, data);

    return inference.save();
  }

  public async paginate(user: User, request: ItemRequest): Promise<PaginatedItem<Inference>> {
    return Inference.paginate(user, request);
  }

  public async cursor(user: User, request: CursorRequest<string>): Promise<CursorItem<Inference, string>> {
    return Inference.cursor(user, request);
  }
}
