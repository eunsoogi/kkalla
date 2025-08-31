import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

import { BlacklistModule } from '../blacklist/blacklist.module';
import { HistoryModule } from '../history/history.module';
import { InferenceModule } from '../inference/inference.module';
import { RedlockModule } from '../redlock/redlock.module';
import { TradeModule } from '../trade/trade.module';
import { UpbitModule } from '../upbit/upbit.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [
    NestScheduleModule.forRoot(),
    RedlockModule,
    TradeModule,
    BlacklistModule,
    HistoryModule,
    InferenceModule,
    UpbitModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
