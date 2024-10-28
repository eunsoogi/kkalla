import { Injectable, Logger } from '@nestjs/common';

import OpenAI from 'openai';
import { ChatCompletion, ChatCompletionMessageParam, ResponseFormatJSONSchema } from 'openai/resources';

import { Feargreed } from '../feargreed/feargreed.interface';
import { FeargreedService } from '../feargreed/feargreed.service';
import { News, NewsTypes } from '../news/news.interface';
import { NewsService } from '../news/news.service';
import { OpenaiService } from '../openai/openai.service';
import { Candle } from '../upbit/upbit.interface';
import { UpbitService } from '../upbit/upbit.service';
import { RequestInferenceDto } from './dto/request-inference.dto';
import { INFERENCE_MAX_TOKENS, INFERENCE_MODEL, INFERENCE_PROMPT, INFERENCE_RESPONSE_SCHEMA } from './inference.config';
import { InferenceData, InferenceResult } from './inference.interface';

@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);

  constructor(
    private readonly openaiService: OpenaiService,
    private readonly upbitService: UpbitService,
    private readonly newsService: NewsService,
    private readonly feargreedService: FeargreedService,
  ) {}

  public async getData(requestInferenceDto: RequestInferenceDto): Promise<InferenceData> {
    const candles: Candle[] = await this.upbitService.getCandles({
      ticker: requestInferenceDto.ticker,
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

    const data: InferenceData = {
      krwBalance: 10000000,
      coinBalance: 0,
      candles: candles,
      news: news,
      feargreed: feargreed,
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
}
