import { Module } from '@nestjs/common';

import { TypeOrmModule } from './databases/typeorm.module';
import { AuthModule } from './modules/auth/auth.module';
import { BlacklistModule } from './modules/blacklist/blacklist.module';
import { CategoryModule } from './modules/category/category.module';
import { ErrorModule } from './modules/error/error.module';
import { FeargreedModule } from './modules/feargreed/feargreed.module';
import { FeatureModule } from './modules/feature/feature.module';
import { HealthModule } from './modules/health/health.module';
import { HistoryModule } from './modules/history/history.module';
import { InferenceModule } from './modules/inference/inference.module';
import { IpModule } from './modules/ip/ip.module';
import { NewsModule } from './modules/news/news.module';
import { NotifyModule } from './modules/notify/notify.module';
import { OpenaiModule } from './modules/openai/openai.module';
import { PermissionModule } from './modules/permission/permission.module';
import { ProfitModule } from './modules/profit/profit.module';
import { RedlockModule } from './modules/redlock/redlock.module';
import { RoleModule } from './modules/role/role.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { SequenceModule } from './modules/sequence/sequence.module';
import { SlackModule } from './modules/slack/slack.module';
import { TradeModule } from './modules/trade/trade.module';
import { TranslateModule } from './modules/translate/translate.module';
import { UpbitModule } from './modules/upbit/upbit.module';
import { UserModule } from './modules/user/user.module';
import { MarketVolatilityModule } from './modules/volatility/volatility.module';

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
    InferenceModule,
    TradeModule,
    HistoryModule,
    BlacklistModule,
    SlackModule,
    NotifyModule,
    ProfitModule,
    CategoryModule,
    FeatureModule,
    MarketVolatilityModule,
  ],
})
export class AppModule {}
