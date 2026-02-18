import { Module, forwardRef } from '@nestjs/common';

import { MarketResearchModule } from '../market-research/market-research.module';
import { RebalanceModule } from '../rebalance/rebalance.module';
import { RedlockModule } from '../redlock/redlock.module';
import { ScheduleExecutionService } from './schedule-execution.service';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [RedlockModule, forwardRef(() => MarketResearchModule), forwardRef(() => RebalanceModule)],
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleExecutionService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
