import { Controller, Get, Query } from '@nestjs/common';

import { RequestNewsDto } from './dto/request-news.dto';
import { News } from './news.interface';
import { NewsService } from './news.service';

@Controller('api/v1/news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  async getNews(@Query() requestNewsDto: RequestNewsDto): Promise<News[]> {
    return this.newsService.getNews(requestNewsDto);
  }
}