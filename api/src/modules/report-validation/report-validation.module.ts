import { Module } from '@nestjs/common';

import { ErrorModule } from '../error/error.module';
import { NotifyModule } from '../notify/notify.module';
import { OpenaiModule } from '../openai/openai.module';
import { UpbitModule } from '../upbit/upbit.module';
import { ReportValidationItemSubscriber } from './entities/report-validation-item.subscriber';
import { ReportValidationRunSubscriber } from './entities/report-validation-run.subscriber';
import { ReportValidationController } from './report-validation.controller';
import { ReportValidationService } from './report-validation.service';

@Module({
  imports: [OpenaiModule, UpbitModule, NotifyModule, ErrorModule],
  controllers: [ReportValidationController],
  providers: [ReportValidationService, ReportValidationRunSubscriber, ReportValidationItemSubscriber],
  exports: [ReportValidationService],
})
export class ReportValidationModule {}
