import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';
import { URL } from 'url';

import { formatDate, parseTimestamp } from '@/utils/date';

import { CacheService } from '../cache/cache.service';
import { ErrorService } from '../error/error.service';
import { API_URL } from './feargreed.config';
import { CompactFeargreed, Feargreed, FeargreedApiResponse, FeargreedHistory } from './feargreed.interface';

@Injectable()
export class FeargreedService {
  constructor(
    private readonly errorService: ErrorService,
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
  ) {}

  public async getFeargreed(): Promise<Feargreed> {
    const cacheKey = 'feargreed:latest';
    const cached = await this.cacheService.get<Feargreed>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL(API_URL);
    url.searchParams.set('limit', '2');

    const { data } = await this.errorService.retry(async () =>
      firstValueFrom(this.httpService.get<FeargreedApiResponse>(url.toString())),
    );

    const item = this.toSingleFeargreed(data);
    // 공포/탐욕 지수는 보통 1일 주기로 갱신되지만, 안전하게 짧게 캐시 (예: 5분)
    await this.cacheService.set(cacheKey, item, 300);

    return item;
  }

  public async getFeargreedHistory(limit: number = 30): Promise<FeargreedHistory> {
    const cacheKey = `feargreed:history:${limit}`;
    const cached = await this.cacheService.get<FeargreedHistory>(cacheKey);
    if (cached) {
      return cached;
    }

    const url = new URL(API_URL);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('date_format', 'kr');

    const { data } = await this.errorService.retry(async () =>
      firstValueFrom(this.httpService.get<FeargreedApiResponse>(url.toString())),
    );

    const history = this.toFeargreedHistory(data);
    await this.cacheService.set(cacheKey, history, 300);

    return history;
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

  /**
   * full 캐시에만 의존하고 compact는 별도 캐시하지 않음.
   * (compact를 따로 캐시하면 full 만료 후에도 compact가 남아 오래된 데이터를 반환할 수 있음)
   */
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
