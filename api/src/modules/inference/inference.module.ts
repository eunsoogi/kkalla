import { Module } from '@nestjs/common';

import { ErrorModule } from '../error/error.module';
import { FeargreedModule } from '../feargreed/feargreed.module';
import { FeatureModule } from '../feature/feature.module';
import { NewsModule } from '../news/news.module';
import { NotifyModule } from '../notify/notify.module';
import { OpenaiModule } from '../openai/openai.module';
import { UpbitModule } from '../upbit/upbit.module';
import { InferenceController } from './inference.controller';
import { InferenceService } from './inference.service';

@Module({
  imports: [ErrorModule, OpenaiModule, UpbitModule, FeatureModule, NewsModule, FeargreedModule, NotifyModule],
  controllers: [InferenceController],
  providers: [InferenceService],
  exports: [InferenceService],
})
export class InferenceModule {}
