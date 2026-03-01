import { Module } from '@nestjs/common';

import { CategoryModule } from '@/modules/category/category.module';

import { AllocationSlotService } from './allocation-slot.service';
import { TradeOrchestrationService } from './trade-orchestration.service';

@Module({
  imports: [CategoryModule],
  providers: [AllocationSlotService, TradeOrchestrationService],
  exports: [AllocationSlotService, TradeOrchestrationService],
})
export class AllocationCoreModule {}
