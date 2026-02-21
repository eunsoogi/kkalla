import { Module, forwardRef } from '@nestjs/common';

import { BlacklistModule } from '../blacklist/blacklist.module';
import { CacheModule } from '../cache/cache.module';
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
import { ReportValidationModule } from '../report-validation/report-validation.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { TradeExecutionLedgerModule } from '../trade-execution-ledger/trade-execution-ledger.module';
import { UpbitModule } from '../upbit/upbit.module';
import { UserModule } from '../user/user.module';
import { BalanceRecommendationSubscriber } from './entities/balance-recommendation.subscriber';
import { RebalanceController } from './rebalance.controller';
import { RebalanceService } from './rebalance.service';

@Module({
  imports: [
    RedlockModule,
    CacheModule,
    BlacklistModule,
    CategoryModule,
    HistoryModule,
    NotifyModule,
    ProfitModule,
    UpbitModule,
    forwardRef(() => ScheduleModule),
    NewsModule,
    FeargreedModule,
    OpenaiModule,
    FeatureModule,
    ErrorModule,
    ReportValidationModule,
    UserModule,
    TradeExecutionLedgerModule,
  ],
  controllers: [RebalanceController],
  providers: [RebalanceService, BalanceRecommendationSubscriber],
  exports: [RebalanceService],
})
export class RebalanceModule {}
