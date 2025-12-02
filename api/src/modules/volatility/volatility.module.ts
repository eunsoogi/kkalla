import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

import { HistoryModule } from '../history/history.module';
import { InferenceModule } from '../inference/inference.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { SlackModule } from '../slack/slack.module';
import { TradeModule } from '../trade/trade.module';
import { UpbitModule } from '../upbit/upbit.module';
import { MarketVolatilityService } from './volatility.service';

@Module({
  imports: [
    NestScheduleModule.forRoot(),
    HistoryModule,
    InferenceModule,
    UpbitModule,
    SlackModule,
    TradeModule,
    ScheduleModule,
  ],
  providers: [MarketVolatilityService],
})
export class MarketVolatilityModule {}
