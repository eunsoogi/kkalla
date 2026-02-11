import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { ErrorModule } from '../error/error.module';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

@Module({
  imports: [ErrorModule, HttpModule, CacheModule],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
