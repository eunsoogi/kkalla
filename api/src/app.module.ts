import { Module } from '@nestjs/common';

import { TypeOrmModule } from './databases/typeorm.module';
import { AuthModule } from './modules/auth/auth.module';
import { FeargreedModule } from './modules/feargreed/feargreed.module';
import { FirechartModule } from './modules/firechart/firechart.module';
import { HealthModule } from './modules/health/health.module';
import { InferenceModule } from './modules/inference/inference.module';
import { NewsModule } from './modules/news/news.module';
import { NotifyModule } from './modules/notify/notify.module';
import { OpenaiModule } from './modules/openai/openai.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { SequenceModule } from './modules/sequence/sequence.module';
import { SlackModule } from './modules/slack/slack.module';
import { TradeModule } from './modules/trade/trade.module';
import { TranslateModule } from './modules/translate/translate.module';
import { UpbitModule } from './modules/upbit/upbit.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    HealthModule,
    TranslateModule,
    TypeOrmModule,
    AuthModule,
    UserModule,
    OpenaiModule,
    UpbitModule,
    NewsModule,
    FeargreedModule,
    InferenceModule,
    TradeModule,
    ScheduleModule,
    SlackModule,
    NotifyModule,
    FirechartModule,
    SequenceModule,
  ],
})
export class AppModule {}
