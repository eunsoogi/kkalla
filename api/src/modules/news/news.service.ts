import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';
import { firstValueFrom } from 'rxjs';

import { CursorItem } from '@/modules/item/item.interface';

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
  ) {}

  public async getNews(request: NewsRequest, retryOptions?: RetryOptions): Promise<News[]> {
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

    return this.toNews(data);
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
    return this.toCompactNews(items);
  }

  private toCompactNews(items: News[]): CompactNews[] {
    return items.map((item) => ({
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
}
