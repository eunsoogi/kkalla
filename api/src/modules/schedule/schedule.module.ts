import { Module, forwardRef } from '@nestjs/common';

import { AllocationAuditModule } from '../allocation-audit/allocation-audit.module';
import { AllocationModule } from '../allocation/allocation.module';
import { MarketIntelligenceModule } from '../market-intelligence/market-intelligence.module';
import { RedlockModule } from '../redlock/redlock.module';
import { ScheduleExecutionService } from './schedule-execution.service';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [
    RedlockModule,
    forwardRef(() => MarketIntelligenceModule),
    forwardRef(() => AllocationModule),
    AllocationAuditModule,
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleExecutionService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
