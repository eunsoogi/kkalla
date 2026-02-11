import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';
import { firstValueFrom } from 'rxjs';

import { CursorItem } from '@/modules/item/item.interface';

import { CacheService } from '../cache/cache.service';
import { Category } from '../category/category.enum';
import { RetryOptions } from '../error/error.interface';
import { ErrorService } from '../error/error.service';
import { API_URL } from './news.config';
import { NewsTypes } from './news.enum';
import { CompactNews, News, NewsApiResponse, NewsRequest } from './news.interface';
import { ImportanceLevel } from './news.type';

@Injectable()
export class NewsService {
  constructor(
    private readonly i18n: I18nService,
    private readonly errorService: ErrorService,
    private readonly httpService: HttpService,
    private readonly cacheService: CacheService,
  ) {}

  private buildCacheKey(request: NewsRequest): string {
    const parts = [
      `type:${request.type}`,
      `cursor:${request.cursor ?? 'null'}`,
      `limit:${request.limit ?? 'null'}`,
      `importanceLower:${request.importanceLower ?? 'null'}`,
      `skip:${request.skip ? '1' : '0'}`,
    ];
    return `news:${parts.join('|')}`;
  }

  public async getNews(request: NewsRequest, retryOptions?: RetryOptions): Promise<News[]> {
    // 외부 뉴스 API는 상대적으로 비싸므로 간단 캐시 (예: 60초)
    const cacheKey = this.buildCacheKey(request);
    const cached = await this.cacheService.get<News[]>(cacheKey);
    if (cached !== null && Array.isArray(cached)) {
      return cached;
    }

    const { data } = await this.errorService.retry(
      async () =>
        firstValueFrom(
          this.httpService.get<NewsApiResponse>(API_URL, {
            params: {
              q: JSON.stringify({
                t1: request.type,
              }),
              seq: request.cursor,
              limit: request.limit,
            },
          }),
        ),
      retryOptions,
    );

    const items = this.toNews(data);
    await this.cacheService.set(cacheKey, items, 60);

    return items;
  }

  private toNews(response: NewsApiResponse): News[] {
    const news = response.docs.map(
      (item): News => ({
        id: item._id,
        seq: item.seq,
        labels: item.Labels,
        title: item.제목,
        source: item.뉴스출처,
        link: item.뉴스링크,
        importance: item.중요도 as ImportanceLevel,
        marketAnalysis: item.시황분석,
        relatedStocks: item.관련종목,
        publishedAt: item.게시시간,
      }),
    );

    return news;
  }

  public async getCompactNews(request: NewsRequest): Promise<CompactNews[]> {
    const items = await this.getNews(request);
    return this.toCompactNews(items, request);
  }

  private toCompactNews(items: News[], request: NewsRequest): CompactNews[] {
    const importanceLower = request.importanceLower ?? 0; // 기본값 0으로 설정 (모든 뉴스 표시)

    return items
      .filter((item) => item.importance >= importanceLower)
      .map((item) => ({
        title: item.title,
        importance: item.importance,
        timestamp: new Date(item.publishedAt).getTime(),
      }));
  }

  public getNewsType(category: Category): NewsTypes {
    switch (category) {
      case Category.COIN_MAJOR:
      case Category.COIN_MINOR:
        return NewsTypes.COIN;

      case Category.NASDAQ:
        return NewsTypes.OVERSEAS_STOCK;

      default:
        throw new Error(
          this.i18n.t('logging.category.unknown', {
            args: { category },
          }),
        );
    }
  }

  public async cursor(request: NewsRequest): Promise<CursorItem<News, number>> {
    const limit = request.limit++;
    const items = await this.getNews(request);
    const hasNextPage = items.length > limit;

    if (hasNextPage) {
      items.pop();
    }

    const nextCursor = hasNextPage ? items[items.length - 1].seq : null;

    return {
      items,
      hasNextPage,
      nextCursor,
      total: items.length,
    };
  }

  /**
   * 대시보드 위젯용: 최신 뉴스 정확히 10건 반환 (시간/중요도 필터 없음)
   */
  public async getNewsForDashboard(limit = 10): Promise<News[]> {
    const request: NewsRequest = {
      type: NewsTypes.COIN,
      limit,
      skip: true,
    };
    const items = await this.getNews(request);
    return items.slice(0, limit);
  }
}
