import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';

import { API_URL, FIRECHART_KEYWORD } from './firechart.config';
import { LoungeApiResponse, LoungeRecord, LoungeRequest } from './firechart.interface';

@Injectable()
export class FirechartService {
  constructor(private readonly httpService: HttpService) {}

  public async getLoungeRecord(request: LoungeRequest): Promise<LoungeRecord[]> {
    const { data } = await firstValueFrom(
      this.httpService.get<LoungeApiResponse>(API_URL, {
        params: request,
      }),
    );

    return this.toLoungeRecord(data);
  }

  private toLoungeRecord(response: LoungeApiResponse): LoungeRecord[] {
    return response.records;
  }

  public async getFirechart(): Promise<string> {
    const records = await this.getLoungeRecord({
      keyword: FIRECHART_KEYWORD,
      limit: 1,
    });

    if (!records) {
      return null;
    }

    return records[0].contentRaw.find((item) => item.type === 'image').value;
  }
}
