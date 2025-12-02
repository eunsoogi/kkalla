import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

import { CategoryModule } from '../category/category.module';
import { ErrorModule } from '../error/error.module';
import { FeargreedModule } from '../feargreed/feargreed.module';
import { FeatureModule } from '../feature/feature.module';
import { HistoryModule } from '../history/history.module';
import { NewsModule } from '../news/news.module';
import { NotifyModule } from '../notify/notify.module';
import { OpenaiModule } from '../openai/openai.module';
import { ProfitModule } from '../profit/profit.module';
import { RedlockModule } from '../redlock/redlock.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { SlackModule } from '../slack/slack.module';
import { UpbitModule } from '../upbit/upbit.module';
import { MarketVolatilityService } from './market-volatility.service';

@Module({
  imports: [
    NestScheduleModule.forRoot(),
    RedlockModule,
    HistoryModule,
    UpbitModule,
    SlackModule,
    forwardRef(() => ScheduleModule),
    CategoryModule,
    NotifyModule,
    ProfitModule,
    NewsModule,
    FeargreedModule,
    OpenaiModule,
    FeatureModule,
    ErrorModule,
  ],
  providers: [MarketVolatilityService],
})
export class MarketVolatilityModule {}
