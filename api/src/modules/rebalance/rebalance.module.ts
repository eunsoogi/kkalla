import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';

import { BlacklistModule } from '../blacklist/blacklist.module';
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
import { ScheduleModule } from '../schedule/schedule.module';
import { UpbitModule } from '../upbit/upbit.module';
import { BalanceRecommendationSubscriber } from './entities/balance-recommendation.subscriber';
import { RebalanceController } from './rebalance.controller';
import { RebalanceService } from './rebalance.service';

@Module({
  imports: [
    NestScheduleModule.forRoot(),
    RedlockModule,
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
  ],
  controllers: [RebalanceController],
  providers: [RebalanceService, BalanceRecommendationSubscriber],
  exports: [RebalanceService],
})
export class RebalanceModule {}
