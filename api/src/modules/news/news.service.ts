import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';

import { firstValueFrom } from 'rxjs';

import { RequestNewsDto } from './dto/request-news.dto';
import { API_URL } from './news.config';
import { News, NewsResponse } from './news.interface';

@Injectable()
export class NewsService {
  constructor(private readonly httpService: HttpService) {}

  public async getNews(requestNewsDto: RequestNewsDto): Promise<News[]> {
    const { data } = await firstValueFrom(
      this.httpService.get<NewsResponse>(API_URL, {
        params: {
          q: JSON.stringify({
            t1: requestNewsDto.type,
          }),
          limit: requestNewsDto.limit,
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
