import { Controller, Get, Query } from '@nestjs/common';

import { CursorItem } from '@/modules/item/item.types';

import { GetNewsDto } from './dto/get-news.dto';
import { NewsService } from './news.service';
import { News } from './news.types';

@Controller('api/v1/news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get('cursor')
  async get(@Query() params: GetNewsDto): Promise<CursorItem<News, number>> {
    return this.newsService.cursor(params);
  }

  /**
   * 대시보드 위젯용: 최신 뉴스 정확히 10건 (시간/중요도 필터 없음)
   */
  @Get('dashboard')
  async getDashboard(@Query('limit') limit?: string): Promise<News[]> {
    const parsed = limit != null ? parseInt(limit, 10) : NaN;
    const limitNum = Number.isNaN(parsed) || parsed < 1 ? 10 : Math.min(parsed, 20);
    return this.newsService.getNewsForDashboard(limitNum);
  }
}
