import { Injectable, Logger } from '@nestjs/common';

import OpenAI from 'openai';
import { ChatCompletion, ChatCompletionMessageParam, ResponseFormatJSONSchema } from 'openai/resources/index.mjs';

import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/interfaces/item.interface';

import { Feargreed } from '../feargreeds/feargreed.interface';
import { FeargreedService } from '../feargreeds/feargreed.service';
import { NewsTypes } from '../news/news.enum';
import { News } from '../news/news.interface';
import { NewsService } from '../news/news.service';
import { OpenaiService } from '../openai/openai.service';
import { Candle } from '../upbit/upbit.interface';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../users/entities/user.entity';
import { Inference } from './entities/inference.entity';
import { INFERENCE_MAX_TOKENS, INFERENCE_MODEL, INFERENCE_PROMPT, INFERENCE_RESPONSE_SCHEMA } from './inference.config';
import { InferenceData, InferenceMessage, InferenceMessageRequest, InferenceResult } from './inference.interface';

@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);

  constructor(
    private readonly openaiService: OpenaiService,
    private readonly upbitService: UpbitService,
    private readonly newsService: NewsService,
    private readonly feargreedService: FeargreedService,
  ) {}

  public async getMessage(user: User, request: InferenceMessageRequest): Promise<InferenceMessage> {
    const candles: Candle[] = await this.upbitService.getCandles(user, request);

    const news: News[] = await this.newsService.get({
      type: NewsTypes.COIN,
      limit: request.newsLimit,
    });

    const feargreed: Feargreed = await this.feargreedService.get();

    const inferenceResult: PaginatedItem<Inference> = await this.paginate(user, {
      page: 1,
      perPage: request.inferenceLimit,
    });

    const inferences: Inference[] = inferenceResult.items;

    const data: InferenceMessage = {
      candles: candles,
      news: news,
      feargreed: feargreed,
      prevInferences: inferences,
    };

    return data;
  }

  public getMessageParams(message: InferenceMessage): ChatCompletionMessageParam[] {
    return [
      {
        role: 'system',
        content: INFERENCE_PROMPT.join('\n'),
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

  public async inference(user: User, request: InferenceMessageRequest): Promise<InferenceResult> {
    const service: OpenAI = await this.openaiService.getClient(user);

    const message: InferenceMessage = await this.getMessage(user, request);

    const response: ChatCompletion = await service.chat.completions.create({
      model: INFERENCE_MODEL,
      max_tokens: INFERENCE_MAX_TOKENS,
      messages: this.getMessageParams(message),
      response_format: this.getResponseFormat(),
      stream: false,
    });

    this.logger.log(response);

    const result: InferenceResult = {
      ...JSON.parse(response.choices[0].message?.content || '{}'),
      symbol: request.symbol,
    };

    return result;
  }

  public async inferenceAndSave(user: User, request: InferenceMessageRequest): Promise<Inference> {
    const inferenceResult = await this.inference(user, request);
    const inferenceEntity = await this.create(user, inferenceResult);

    return inferenceEntity;
  }

  public async create(user: User, data: InferenceData): Promise<Inference> {
    const inference = new Inference();

    inference.user = user;
    Object.entries(data).forEach(([key, value]) => (inference[key] = value));

    return inference.save();
  }

  public async paginate(user: User, request: ItemRequest): Promise<PaginatedItem<Inference>> {
    return Inference.paginate(user, request);
  }

  public async cursor(user: User, request: CursorRequest<string>): Promise<CursorItem<Inference, string>> {
    return Inference.cursor(user, request);
  }
}
