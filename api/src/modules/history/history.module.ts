import { Module } from '@nestjs/common';

import { UpbitModule } from '../upbit/upbit.module';
import { HistoryService } from './history.service';
import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';

@Module({
  imports: [UpbitModule],
  controllers: [HoldingsController],
  providers: [HistoryService, HoldingsService],
  exports: [HistoryService],
})
export class HistoryModule {}
