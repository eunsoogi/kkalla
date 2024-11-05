import { Module } from '@nestjs/common';

import { UpbitService } from './upbit.service';

@Module({
  providers: [UpbitService],
  exports: [UpbitService],
})
export class UpbitModule {}
