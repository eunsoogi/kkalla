import { Module } from '@nestjs/common';

import { ErrorModule } from '../error/error.module';
import { NotifyModule } from '../notify/notify.module';
import { OpenaiService } from './openai.service';

@Module({
  imports: [ErrorModule, NotifyModule],
  providers: [OpenaiService],
  exports: [OpenaiService],
})
export class OpenaiModule {}
