import { Injectable } from '@nestjs/common';

import OpenAI from 'openai';
import { ChatCompletion, ChatCompletionMessageParam, ResponseFormatJSONSchema } from 'openai/resources';

import { FindItemDto } from '../../dto/find-item.dto';
import { PaginatedItemDto } from '../../dto/paginated-item.dto';
import { FeargreedService } from '../feargreed/feargreed.service';
import { Feargreed } from '../feargreed/feargreed.type';
import { NewsService } from '../news/news.service';
import { News, NewsTypes } from '../news/news.type';
import { OpenaiService } from '../openai/openai.service';
import { UpbitService } from '../upbit/upbit.service';
import { Candle } from '../upbit/upbit.type';
import { CreateInferenceDto } from './dto/create-inference.dto';
import { RequestInferenceDto } from './dto/request-inference.dto';
import { Inference } from './entities/inference.entity';
import { INFERENCE_MAX_TOKENS, INFERENCE_MODEL, INFERENCE_PROMPT, INFERENCE_RESPONSE_SCHEMA } from './inference.config';
import { InferenceData, InferenceResult } from './inference.type';

@Injectable()
export class InferenceService {
  constructor(
    private readonly openaiService: OpenaiService,
    private readonly upbitService: UpbitService,
    private readonly newsService: NewsService,
    private readonly feargreedService: FeargreedService,
  ) {}

  public async getData(requestInferenceDto: RequestInferenceDto): Promise<InferenceData> {
    const candles: Candle[] = await this.upbitService.getCandles({
      symbol: requestInferenceDto.symbol,
      countM15: requestInferenceDto.countM15,
      countH1: requestInferenceDto.countH1,
      countH4: requestInferenceDto.countH4,
      countD1: requestInferenceDto.countD1,
    });

    const news: News[] = await this.newsService.getNews({
      type: NewsTypes.COIN,
      limit: requestInferenceDto.newsLimit,
    });

    const feargreed: Feargreed = await this.feargreedService.getFeargreed();

    const inferenceResult: PaginatedItemDto<Inference> = await this.paginate({
      page: 1,
      perPage: requestInferenceDto.inferenceLimit,
    });

    const inferences: Inference[] = inferenceResult.items;

    const data: InferenceData = {
      candles: candles,
      news: news,
      feargreed: feargreed,
      prevInferences: inferences,
    };

    return data;
  }

  public getMessage(data: InferenceData): ChatCompletionMessageParam[] {
    return [
      {
        role: 'system',
        content: INFERENCE_PROMPT.join('\n'),
      },
      {
        role: 'user',
        content: JSON.stringify(data),
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

  public async inference(requestInferenceDto: RequestInferenceDto): Promise<InferenceResult> {
    const service: OpenAI = await this.openaiService.getClient();

    const data: InferenceData = await this.getData(requestInferenceDto);

    const response: ChatCompletion = await service.chat.completions.create({
      model: INFERENCE_MODEL,
      max_tokens: INFERENCE_MAX_TOKENS,
      messages: this.getMessage(data),
      response_format: this.getResponseFormat(),
      stream: false,
    });

    const result: InferenceResult = JSON.parse(response.choices[0].message?.content || '{}');

    return result;
  }

  public async inferenceAndSave(requestInferenceDto: RequestInferenceDto): Promise<Inference> {
    const inferenceResult = await this.inference(requestInferenceDto);
    const inferenceEntity = await this.create(inferenceResult);

    return inferenceEntity;
  }

  public async create(createInferenceDto: CreateInferenceDto): Promise<Inference> {
    const inference = new Inference();

    Object.entries(createInferenceDto).forEach(([key, value]) => (inference[key] = value));
    await inference.save();

    return inference;
  }

  public async paginate(findItemDto: FindItemDto): Promise<PaginatedItemDto<Inference>> {
    return Inference.paginate(findItemDto);
  }
}
