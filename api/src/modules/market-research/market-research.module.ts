import { Module } from '@nestjs/common';

import { BlacklistModule } from '../blacklist/blacklist.module';
import { CacheModule } from '../cache/cache.module';
import { ErrorModule } from '../error/error.module';
import { FeargreedModule } from '../feargreed/feargreed.module';
import { FeatureModule } from '../feature/feature.module';
import { NewsModule } from '../news/news.module';
import { NotifyModule } from '../notify/notify.module';
import { OpenaiModule } from '../openai/openai.module';
import { RedlockModule } from '../redlock/redlock.module';
import { ReportValidationModule } from '../report-validation/report-validation.module';
import { UpbitModule } from '../upbit/upbit.module';
import { MarketRecommendationSubscriber } from './entities/market-recommendation.subscriber';
import { MarketResearchController } from './market-research.controller';
import { MarketResearchService } from './market-research.service';

@Module({
  imports: [
    RedlockModule,
    CacheModule,
    NotifyModule,
    BlacklistModule,
    UpbitModule,
    NewsModule,
    FeargreedModule,
    OpenaiModule,
    FeatureModule,
    ErrorModule,
    ReportValidationModule,
  ],
  controllers: [MarketResearchController],
  providers: [MarketResearchService, MarketRecommendationSubscriber],
  exports: [MarketResearchService],
})
export class MarketResearchModule {}
