import { Module, forwardRef } from '@nestjs/common';

import { AllocationAuditModule } from '../allocation-audit/allocation-audit.module';
import { BlacklistModule } from '../blacklist/blacklist.module';
import { CacheModule } from '../cache/cache.module';
import { CategoryModule } from '../category/category.module';
import { ErrorModule } from '../error/error.module';
import { FeargreedModule } from '../feargreed/feargreed.module';
import { FeatureModule } from '../feature/feature.module';
import { HoldingLedgerModule } from '../holding-ledger/holding-ledger.module';
import { NewsModule } from '../news/news.module';
import { NotifyModule } from '../notify/notify.module';
import { OpenaiModule } from '../openai/openai.module';
import { ProfitModule } from '../profit/profit.module';
import { RedlockModule } from '../redlock/redlock.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { TradeExecutionLedgerModule } from '../trade-execution-ledger/trade-execution-ledger.module';
import { UpbitModule } from '../upbit/upbit.module';
import { UserModule } from '../user/user.module';
import { AllocationController } from './allocation.controller';
import { AllocationService } from './allocation.service';
import { AllocationRecommendationSubscriber } from './entities/allocation-recommendation.subscriber';

@Module({
  imports: [
    RedlockModule,
    CacheModule,
    BlacklistModule,
    CategoryModule,
    HoldingLedgerModule,
    NotifyModule,
    ProfitModule,
    UpbitModule,
    forwardRef(() => ScheduleModule),
    NewsModule,
    FeargreedModule,
    OpenaiModule,
    FeatureModule,
    ErrorModule,
    AllocationAuditModule,
    UserModule,
    TradeExecutionLedgerModule,
  ],
  controllers: [AllocationController],
  providers: [AllocationService, AllocationRecommendationSubscriber],
  exports: [AllocationService],
})
export class AllocationModule {}
