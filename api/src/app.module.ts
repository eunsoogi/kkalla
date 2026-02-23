import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

import { TypeOrmModule } from './databases/typeorm.module';
import { AllocationAuditModule } from './modules/allocation-audit/allocation-audit.module';
import { AllocationModule } from './modules/allocation/allocation.module';
import { AuthModule } from './modules/auth/auth.module';
import { BlacklistModule } from './modules/blacklist/blacklist.module';
import { CategoryModule } from './modules/category/category.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ErrorModule } from './modules/error/error.module';
import { FeargreedModule } from './modules/feargreed/feargreed.module';
import { FeatureModule } from './modules/feature/feature.module';
import { HealthModule } from './modules/health/health.module';
import { HoldingLedgerModule } from './modules/holding-ledger/holding-ledger.module';
import { IpModule } from './modules/ip/ip.module';
import { MarketIntelligenceModule } from './modules/market-intelligence/market-intelligence.module';
import { MarketRiskModule } from './modules/market-risk/market-risk.module';
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
import { TradeExecutionLedgerModule } from './modules/trade-execution-ledger/trade-execution-ledger.module';
import { TradeModule } from './modules/trade/trade.module';
import { TranslateModule } from './modules/translate/translate.module';
import { UpbitModule } from './modules/upbit/upbit.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    // Core modules
    TypeOrmModule,
    NestScheduleModule.forRoot(),
    RedlockModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    TranslateModule,
    SequenceModule,
    // Feature modules (alphabetical order)
    AuthModule,
    BlacklistModule,
    CategoryModule,
    DashboardModule,
    ErrorModule,
    FeargreedModule,
    FeatureModule,
    HealthModule,
    HoldingLedgerModule,
    IpModule,
    MarketIntelligenceModule,
    MarketRiskModule,
    NewsModule,
    NotifyModule,
    OpenaiModule,
    PermissionModule,
    ProfitModule,
    AllocationModule,
    AllocationAuditModule,
    RoleModule,
    ScheduleModule,
    SlackModule,
    TradeModule,
    TradeExecutionLedgerModule,
    UpbitModule,
    UserModule,
  ],
})
export class AppModule {}
