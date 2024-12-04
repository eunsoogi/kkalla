import { Module } from '@nestjs/common';

import { NotifyModule } from '../notify/notify.module';
import { UpbitController } from './upbit.controller';
import { UpbitService } from './upbit.service';

@Module({
  imports: [NotifyModule],
  controllers: [UpbitController],
  providers: [UpbitService],
  exports: [UpbitService],
})
export class UpbitModule {}
