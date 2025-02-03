import { Module } from '@nestjs/common';

import { ErrorModule } from '../error/error.module';
import { NotifyModule } from '../notify/notify.module';
import { UpbitController } from './upbit.controller';
import { UpbitService } from './upbit.service';

@Module({
  imports: [ErrorModule, NotifyModule],
  controllers: [UpbitController],
  providers: [UpbitService],
  exports: [UpbitService],
})
export class UpbitModule {}
