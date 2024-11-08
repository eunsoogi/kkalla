import { Module } from '@nestjs/common';

import { UpbitController } from './upbit.controller';
import { UpbitService } from './upbit.service';

@Module({
  controllers: [UpbitController],
  providers: [UpbitService],
  exports: [UpbitService],
})
export class UpbitModule {}
