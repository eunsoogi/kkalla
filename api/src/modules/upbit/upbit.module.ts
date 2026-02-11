import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { ErrorModule } from '../error/error.module';
import { NotifyModule } from '../notify/notify.module';
import { UpbitController } from './upbit.controller';
import { UpbitService } from './upbit.service';

@Module({
  imports: [ErrorModule, NotifyModule, CacheModule],
  controllers: [UpbitController],
  providers: [UpbitService],
  exports: [UpbitService],
})
export class UpbitModule {}
