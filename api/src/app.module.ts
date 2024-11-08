import { Module } from '@nestjs/common';
import { ScheduleModule as ScheduleModuleRoot } from '@nestjs/schedule';

import { TypeOrmModule } from './databases/typeorm.module';
import { AuthModule } from './modules/auth/auth.module';
import { FeargreedModule } from './modules/feargreed/feargreed.module';
import { HealthModule } from './modules/health/health.module';
import { InferenceModule } from './modules/inference/inference.module';
import { NewsModule } from './modules/news/news.module';
import { NotifyModule } from './modules/notify/notify.module';
import { OpenaiModule } from './modules/openai/openai.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { SlackModule } from './modules/slack/slack.module';
import { TradeModule } from './modules/trade/trade.module';
import { UpbitModule } from './modules/upbit/upbit.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ScheduleModuleRoot.forRoot(),
    TypeOrmModule,
    AuthModule,
    UserModule,
    OpenaiModule,
    UpbitModule,
    NewsModule,
    FeargreedModule,
    InferenceModule,
    TradeModule,
    HealthModule,
    ScheduleModule,
    SlackModule,
    NotifyModule,
  ],
})
export class AppModule {}
