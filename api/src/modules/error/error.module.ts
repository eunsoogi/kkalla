import { Module } from '@nestjs/common';

import { NotifyModule } from '../notify/notify.module';
import { ErrorService } from './error.service';

@Module({
  imports: [NotifyModule],
  providers: [ErrorService],
  exports: [ErrorService],
})
export class ErrorModule {}
