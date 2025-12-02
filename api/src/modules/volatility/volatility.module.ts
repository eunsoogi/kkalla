import { Module } from '@nestjs/common';

import { HistoryModule } from '../history/history.module';
import { InferenceModule } from '../inference/inference.module';
import { SlackModule } from '../slack/slack.module';
import { UpbitModule } from '../upbit/upbit.module';
import { MarketVolatilityService } from './volatility.service';

@Module({
  imports: [HistoryModule, InferenceModule, UpbitModule, SlackModule],
  providers: [MarketVolatilityService],
})
export class MarketVolatilityModule {}
