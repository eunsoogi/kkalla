import { Controller, Get, Query } from '@nestjs/common';

import { GetNewsDto } from './dto/get-news.dto';
import { News } from './news.interface';
import { NewsService } from './news.service';

@Controller('api/v1/news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  async get(@Query() params: GetNewsDto): Promise<News[]> {
    return this.newsService.getNews(params);
  }
}
