import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';

import { Feargreed, FeargreedResponse } from './feargreed.interface';

@Injectable()
export class FeargreedService {
  public static readonly API_URL = 'https://ubci-api.ubcindex.com/v1/crix/feargreed';

  constructor(private readonly httpService: HttpService) {}

  public async getFeargreed(): Promise<Feargreed> {
    const { data } = await firstValueFrom(this.httpService.get<FeargreedResponse>(FeargreedService.API_URL));

    const feargreed = this.transformToFeargreed(data);

    return feargreed;
  }

  private transformToFeargreed(response: FeargreedResponse): Feargreed {
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
      pair: response.pair?.map((item) => ({
        date: item.date,
        code: item.code,
        koreanName: item.korean_name,
        changeRate: item.change_rate,
        clsPrc: item.cls_prc,
        score: item.score,
        stage: item.stage_en,
      })),
    };
  }
}
