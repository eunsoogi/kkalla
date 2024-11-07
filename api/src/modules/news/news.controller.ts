import { Controller, Get, Query } from '@nestjs/common';

import { CursorItem } from '@/modules/item/item.interface';

import { GetNewsDto } from './dto/get-news.dto';
import { News } from './news.interface';
import { NewsService } from './news.service';

@Controller('api/v1/news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('cursor')
  async get(@Query() params: GetNewsDto): Promise<CursorItem<News, number>> {
    return this.newsService.cursor(params);
  }
}
