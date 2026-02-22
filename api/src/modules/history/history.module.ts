import { Module } from '@nestjs/common';

import { CategoryModule } from '../category/category.module';
import { UpbitModule } from '../upbit/upbit.module';
import { HistoryService } from './history.service';
import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';

@Module({
  imports: [UpbitModule, CategoryModule],
  controllers: [HoldingsController],
  providers: [HistoryService, HoldingsService],
  exports: [HistoryService, HoldingsService],
})
export class HistoryModule {}
