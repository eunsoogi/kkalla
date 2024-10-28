import { Module } from '@nestjs/common';

import { ApikeyModule } from '../apikey/apikey.module';
import { OpenaiService } from './openai.service';

@Module({
  imports: [ApikeyModule],
  providers: [OpenaiService],
  exports: [OpenaiService],
})
export class OpenaiModule {}
