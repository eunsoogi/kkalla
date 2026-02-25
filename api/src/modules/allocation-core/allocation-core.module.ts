import { Module } from '@nestjs/common';

import { CategoryModule } from '@/modules/category/category.module';

import { AllocationSlotService } from './allocation-slot.service';

@Module({
  imports: [CategoryModule],
  providers: [AllocationSlotService],
  exports: [AllocationSlotService],
})
export class AllocationCoreModule {}
