import { Module } from '@nestjs/common';

import { ErrorModule } from '../error/error.module';
import { OpenaiService } from './openai.service';

@Module({
  imports: [ErrorModule],
  providers: [OpenaiService],
  exports: [OpenaiService],
})
export class OpenaiModule {}
