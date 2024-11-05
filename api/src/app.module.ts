import { Module } from '@nestjs/common';
import { ScheduleModule as ScheduleModuleRoot } from '@nestjs/schedule';
import { TypeOrmModule as TypeOrmModuleRoot } from '@nestjs/typeorm';

import { ApikeyModule } from './modules/apikey/apikey.module';
import { AuthModule } from './modules/auth/auth.module';
import { FeargreedModule } from './modules/feargreed/feargreed.module';
import { HealthModule } from './modules/health/health.module';
import { InferenceModule } from './modules/inference/inference.module';
import { NewsModule } from './modules/news/news.module';
import { OpenaiModule } from './modules/openai/openai.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { TradeModule } from './modules/trade/trade.module';
import { UpbitModule } from './modules/upbit/upbit.module';
import { UserModule } from './modules/user/user.module';
import { typeORMConfig } from './typeorm.config';

@Module({
  imports: [
    TypeOrmModuleRoot.forRoot(typeORMConfig),
    ScheduleModuleRoot.forRoot(),
    AuthModule,
    UserModule,
    ApikeyModule,
    OpenaiModule,
    UpbitModule,
    NewsModule,
    FeargreedModule,
    InferenceModule,
    TradeModule,
    HealthModule,
    ScheduleModule,
  ],
})
export class AppModule {}
