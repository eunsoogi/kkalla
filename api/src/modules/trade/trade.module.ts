import { Module } from '@nestjs/common';

import { CategoryModule } from '../category/category.module';
import { HistoryModule } from '../history/history.module';
import { InferenceModule } from '../inference/inference.module';
import { NotifyModule } from '../notify/notify.module';
import { ProfitModule } from '../profit/profit.module';
import { UpbitModule } from '../upbit/upbit.module';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';

@Module({
  imports: [InferenceModule, UpbitModule, ProfitModule, NotifyModule, HistoryModule, CategoryModule],
  controllers: [TradeController],
  providers: [TradeService],
  exports: [TradeService],
})
export class TradeModule {}
