import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';

import { CursorItem } from '@/modules/item/item.interface';

import { API_URL } from './news.config';
import { News, NewsApiResponse, NewsRequest } from './news.interface';
import { ImportanceLevel } from './news.type';

@Injectable()
export class NewsService {
  constructor(private readonly httpService: HttpService) {}

  public async get(request: NewsRequest): Promise<News[]> {
    const { data } = await firstValueFrom(
      this.httpService.get<NewsApiResponse>(API_URL, {
        params: {
          q: JSON.stringify({
            t1: request.type,
          }),
          seq: request.cursor,
          limit: request.limit,
        },
      }),
    );

    return this.transform(data);
  }

  private transform(response: NewsApiResponse): News[] {
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

  public async cursor(request: NewsRequest): Promise<CursorItem<News, number>> {
    const limit = request.limit++;
    const items = await this.get(request);
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
