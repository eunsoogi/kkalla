import { Module } from '@nestjs/common';

import { ApikeyModule } from '../apikey/apikey.module';
import { UpbitService } from './upbit.service';

@Module({
  imports: [ApikeyModule],
  providers: [UpbitService],
  exports: [UpbitService],
})
export class UpbitModule {}
