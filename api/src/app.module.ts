import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApikeyModule } from './modules/apikeys/apikey.module';
import { AuthModule } from './modules/auth/auth.module';
import { FeargreedModule } from './modules/feargreeds/feargreed.module';
import { InferenceModule } from './modules/inferences/inference.module';
import { NewsModule } from './modules/news/news.module';
import { OpenaiModule } from './modules/openai/openai.module';
import { TradeModule } from './modules/trades/trade.module';
import { UpbitModule } from './modules/upbit/upbit.module';
import { UserModule } from './modules/user/user.module';
import { typeORMConfig } from './typeorm.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeORMConfig),
    ScheduleModule.forRoot(),
    AuthModule,
    UserModule,
    ApikeyModule,
    OpenaiModule,
    UpbitModule,
    NewsModule,
    FeargreedModule,
    InferenceModule,
    TradeModule,
  ],
})
export class AppModule {}
