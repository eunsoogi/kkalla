import { Module } from '@nestjs/common';

import { CategoryModule } from '@/modules/category/category.module';
import { TradeModule } from '@/modules/trade/trade.module';

import { AllocationSlotService } from './allocation-slot.service';
import { TradeOrchestrationService } from './trade-orchestration.service';

@Module({
  imports: [CategoryModule, TradeModule],
  providers: [AllocationSlotService, TradeOrchestrationService],
  exports: [AllocationSlotService, TradeOrchestrationService],
})
export class AllocationCoreModule {}
