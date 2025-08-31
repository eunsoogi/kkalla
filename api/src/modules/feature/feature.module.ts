import { Module } from '@nestjs/common';

import { NewsModule } from '@/modules/news/news.module';
import { UpbitModule } from '@/modules/upbit/upbit.module';

import { FeatureService } from './feature.service';

@Module({
  imports: [UpbitModule, NewsModule],
  providers: [FeatureService],
  exports: [FeatureService],
})
export class FeatureModule {}
