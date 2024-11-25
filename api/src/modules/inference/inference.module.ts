import { Module } from '@nestjs/common';

import { DecisionModule } from '../decision/decision.module';
import { FeargreedModule } from '../feargreed/feargreed.module';
import { FirechartModule } from '../firechart/firechart.module';
import { NewsModule } from '../news/news.module';
import { OpenaiModule } from '../openai/openai.module';
import { SequenceModule } from '../sequence/sequence.module';
import { UpbitModule } from '../upbit/upbit.module';
import { InferenceController } from './inference.controller';
import { InferenceService } from './inference.service';

@Module({
  imports: [SequenceModule, DecisionModule, OpenaiModule, UpbitModule, NewsModule, FeargreedModule, FirechartModule],
  controllers: [InferenceController],
  providers: [InferenceService],
  exports: [InferenceService],
})
export class InferenceModule {}
