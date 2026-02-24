import { Module } from '@nestjs/common';

import { ErrorModule } from '../error/error.module';
import { NotifyModule } from '../notify/notify.module';
import { OpenaiModule } from '../openai/openai.module';
import { UpbitModule } from '../upbit/upbit.module';
import { AllocationAuditController } from './allocation-audit.controller';
import { AllocationAuditService } from './allocation-audit.service';

@Module({
  imports: [OpenaiModule, UpbitModule, NotifyModule, ErrorModule],
  controllers: [AllocationAuditController],
  providers: [AllocationAuditService],
  exports: [AllocationAuditService],
})
export class AllocationAuditModule {}
