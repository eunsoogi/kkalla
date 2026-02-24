import { Module, forwardRef } from '@nestjs/common';

import { AllocationAuditModule } from '../allocation-audit/allocation-audit.module';
import { CacheModule } from '../cache/cache.module';
import { CategoryModule } from '../category/category.module';
import { ErrorModule } from '../error/error.module';
import { FeatureModule } from '../feature/feature.module';
import { HoldingLedgerModule } from '../holding-ledger/holding-ledger.module';
import { MarketRegimeModule } from '../market-regime/market-regime.module';
import { NewsModule } from '../news/news.module';
import { NotifyModule } from '../notify/notify.module';
import { OpenaiModule } from '../openai/openai.module';
import { ProfitModule } from '../profit/profit.module';
import { RedlockModule } from '../redlock/redlock.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { SlackModule } from '../slack/slack.module';
import { TradeExecutionLedgerModule } from '../trade-execution-ledger/trade-execution-ledger.module';
import { UpbitModule } from '../upbit/upbit.module';
import { UserModule } from '../user/user.module';
import { MarketRiskService } from './market-risk.service';

@Module({
  imports: [
    RedlockModule,
    CacheModule,
    HoldingLedgerModule,
    UpbitModule,
    SlackModule,
    forwardRef(() => ScheduleModule),
    CategoryModule,
    NotifyModule,
    ProfitModule,
    NewsModule,
    OpenaiModule,
    FeatureModule,
    MarketRegimeModule,
    ErrorModule,
    AllocationAuditModule,
    UserModule,
    TradeExecutionLedgerModule,
  ],
  providers: [MarketRiskService],
})
export class MarketRiskModule {}
