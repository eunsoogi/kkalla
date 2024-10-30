import { Module } from '@nestjs/common';

import { FeargreedModule } from '../feargreeds/feargreed.module';
import { NewsModule } from '../news/news.module';
import { OpenaiModule } from '../openai/openai.module';
import { UpbitModule } from '../upbit/upbit.module';
import { InferenceController } from './inference.controller';
import { InferenceService } from './inference.service';

@Module({
  imports: [OpenaiModule, UpbitModule, NewsModule, FeargreedModule],
  controllers: [InferenceController],
  providers: [InferenceService],
  exports: [InferenceService],
})
export class InferenceModule {}
