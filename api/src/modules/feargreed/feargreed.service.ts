import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';
import { URL } from 'url';

import { formatDate, parseTimestamp } from '@/utils/date';

import { ErrorService } from '../error/error.service';
import { API_URL } from './feargreed.config';
import { CompactFeargreed, Feargreed, FeargreedApiResponse, FeargreedHistory } from './feargreed.interface';

@Injectable()
export class FeargreedService {
  constructor(
    private readonly errorService: ErrorService,
    private readonly httpService: HttpService,
  ) {}

  public async getFeargreed(): Promise<Feargreed> {
    const url = new URL(API_URL);
    url.searchParams.set('limit', '2');

    const { data } = await this.errorService.retry(async () =>
      firstValueFrom(this.httpService.get<FeargreedApiResponse>(url.toString())),
    );

    return this.toSingleFeargreed(data);
  }

  public async getFeargreedHistory(limit: number = 30): Promise<FeargreedHistory> {
    const url = new URL(API_URL);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('date_format', 'kr');

    const { data } = await this.errorService.retry(async () =>
      firstValueFrom(this.httpService.get<FeargreedApiResponse>(url.toString())),
    );

    return this.toFeargreedHistory(data);
  }

  private toSingleFeargreed(response: FeargreedApiResponse): Feargreed {
    const latestData = response.data[0];
    const timestamp = parseTimestamp(latestData.timestamp);
    const currentValue = parseInt(latestData.value);

    let diff = 0;
    if (response.data.length > 1) {
      const previousValue = parseInt(response.data[1].value);
      diff = currentValue - previousValue;
    }

    return {
      value: currentValue,
      classification: latestData.value_classification,
      timestamp,
      date: formatDate(timestamp),
      timeUntilUpdate: parseInt(latestData.time_until_update || '0'),
      diff,
    };
  }

  private toFeargreedHistory(response: FeargreedApiResponse): FeargreedHistory {
    const mappedData = response.data.map((item, index) => {
      const timestamp = parseTimestamp(item.timestamp);
      const currentValue = parseInt(item.value);

      let diff = 0;
      if (index < response.data.length - 1) {
        const previousValue = parseInt(response.data[index + 1].value);
        diff = currentValue - previousValue;
      }

      return {
        value: currentValue,
        classification: item.value_classification,
        timestamp,
        date: formatDate(timestamp),
        timeUntilUpdate: parseInt(item.time_until_update || '0'),
        diff,
      };
    });

    return {
      data: mappedData,
    };
  }

  public async getCompactFeargreed(): Promise<CompactFeargreed> {
    const item = await this.getFeargreed();
    return this.toCompactFeargreed(item);
  }

  private toCompactFeargreed(item: Feargreed): CompactFeargreed {
    return {
      value: item.value,
      classification: item.classification,
      timestamp: item.timestamp,
    };
  }
}
