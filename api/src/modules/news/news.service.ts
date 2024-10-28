import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';

import { News, NewsResponse } from './news.interface';

@Injectable()
export class NewsService {
  public static readonly API_URL = 'https://api.82alda.co.kr:4000/api/v1.0/news';

  public static readonly NEWS_TYPE_COIN = '3';

  constructor(private readonly httpService: HttpService) {}

  public async getNews(limit: number = 100, type: string = NewsService.NEWS_TYPE_COIN): Promise<News[]> {
    const { data } = await firstValueFrom(
      this.httpService.get<NewsResponse>(NewsService.API_URL, {
        params: {
          q: JSON.stringify({
            t1: type,
          }),
          limit: limit,
        },
      }),
    );

    const news = this.transformToNews(data);

    return news;
  }

  private transformToNews(response: NewsResponse): News[] {
    const news = response.docs.map(
      (item): News => ({
        labels: item.Labels,
        title: item.제목,
        importance: item.중요도,
        marketAnalysis: item.시황분석,
        relatedStocks: item.관련종목,
        publishedAt: item.게시시간,
      }),
    );

    return news;
  }
}
