import { Module } from '@nestjs/common';

import { AllocationAuditModule } from '../allocation-audit/allocation-audit.module';
import { BlacklistModule } from '../blacklist/blacklist.module';
import { CacheModule } from '../cache/cache.module';
import { ErrorModule } from '../error/error.module';
import { FeatureModule } from '../feature/feature.module';
import { MarketRegimeModule } from '../market-regime/market-regime.module';
import { NewsModule } from '../news/news.module';
import { NotifyModule } from '../notify/notify.module';
import { OpenaiModule } from '../openai/openai.module';
import { RedlockModule } from '../redlock/redlock.module';
import { UpbitModule } from '../upbit/upbit.module';
import { MarketIntelligenceController } from './market-intelligence.controller';
import { MarketIntelligenceService } from './market-intelligence.service';

@Module({
  imports: [
    RedlockModule,
    CacheModule,
    NotifyModule,
    BlacklistModule,
    UpbitModule,
    NewsModule,
    OpenaiModule,
    FeatureModule,
    MarketRegimeModule,
    ErrorModule,
    AllocationAuditModule,
  ],
  controllers: [MarketIntelligenceController],
  providers: [MarketIntelligenceService],
  exports: [MarketIntelligenceService],
})
export class MarketIntelligenceModule {}
