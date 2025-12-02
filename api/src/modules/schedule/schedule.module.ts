import { Module, forwardRef } from '@nestjs/common';

import { MarketResearchModule } from '../market-research/market-research.module';
import { RebalanceModule } from '../rebalance/rebalance.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [forwardRef(() => MarketResearchModule), forwardRef(() => RebalanceModule)],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
