import { Module } from '@nestjs/common';

import { TypeOrmModule } from './databases/typeorm.module';
import { AccumulationModule } from './modules/accumulation/accumulation.module';
import { AuthModule } from './modules/auth/auth.module';
import { ErrorModule } from './modules/error/error.module';
import { FeargreedModule } from './modules/feargreed/feargreed.module';
import { HealthModule } from './modules/health/health.module';
import { InferenceModule } from './modules/inference/inference.module';
import { IpModule } from './modules/ip/ip.module';
import { NewsModule } from './modules/news/news.module';
import { NotifyModule } from './modules/notify/notify.module';
import { OpenaiModule } from './modules/openai/openai.module';
import { PermissionModule } from './modules/permission/permission.module';
import { RedlockModule } from './modules/redlock/redlock.module';
import { RoleModule } from './modules/role/role.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { SequenceModule } from './modules/sequence/sequence.module';
import { SlackModule } from './modules/slack/slack.module';
import { TradeModule } from './modules/trade/trade.module';
import { TranslateModule } from './modules/translate/translate.module';
import { UpbitModule } from './modules/upbit/upbit.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    RedlockModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    ScheduleModule,
    ErrorModule,
    HealthModule,
    TranslateModule,
    TypeOrmModule,
    SequenceModule,
    AuthModule,
    RoleModule,
    PermissionModule,
    UserModule,
    IpModule,
    OpenaiModule,
    UpbitModule,
    NewsModule,
    FeargreedModule,
    AccumulationModule,
    InferenceModule,
    TradeModule,
    SlackModule,
    NotifyModule,
  ],
})
export class AppModule {}
