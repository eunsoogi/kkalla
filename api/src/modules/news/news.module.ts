import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { ErrorModule } from '../error/error.module';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';

@Module({
  imports: [ErrorModule, HttpModule],
  controllers: [NewsController],
  providers: [NewsService],
  exports: [NewsService],
})
export class NewsModule {}
