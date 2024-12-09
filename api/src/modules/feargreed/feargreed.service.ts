import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';

import { RetryOptions } from '../error/error.interface';
import { ErrorService } from '../error/error.service';
import { API_URL } from './feargreed.config';
import { CompactFeargreed, Feargreed, FeargreedApiResponse } from './feargreed.interface';

@Injectable()
export class FeargreedService {
  constructor(
    private readonly errorService: ErrorService,
    private readonly httpService: HttpService,
  ) {}

  public async getFeargreed(retryOptions?: RetryOptions): Promise<Feargreed> {
    const { data } = await this.errorService.retry(
      async () => firstValueFrom(this.httpService.get<FeargreedApiResponse>(API_URL)),
      retryOptions,
    );

    return this.toFeargreed(data);
  }

  private toFeargreed(response: FeargreedApiResponse): Feargreed {
    return {
      at: response.at,
      today: {
        date: response.today.date,
        score: response.today.score,
        diff: response.today.diff,
        clsPrcUbmi: response.today.cls_prc_ubmi,
        diffUbmi: response.today.diff_ubmi,
        clsPrcUbai: response.today.cls_prc_ubai,
        diffUbai: response.today.diff_ubai,
        stage: response.today.stage_en,
        comment: response.today.comment,
      },
      intv: response.intv?.map((item) => ({
        date: item.date,
        score: item.score,
        diff: item.diff,
        name: item.name,
        stage: item.stage_en,
        comment: item.comment,
      })),
      pairs: response.pairs?.map((item) => ({
        date: item.date,
        code: item.code,
        currency: item.currency,
        score: item.score,
        diff: item.change_rate,
        stage: item.stage_en,
      })),
    };
  }

  public async getCompactFeargreed(symbol: string): Promise<CompactFeargreed> {
    const item = await this.getFeargreed();
    return this.toCompactFeargreed(item, symbol);
  }

  private toCompactFeargreed(item: Feargreed, symbol: string): CompactFeargreed {
    const pair = item.pairs?.find((pair) => pair.currency === symbol);
    return pair;
  }
}
