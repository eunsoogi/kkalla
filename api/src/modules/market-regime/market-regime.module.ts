import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { ErrorModule } from '../error/error.module';
import { MarketRegimeService } from './market-regime.service';

@Module({
  imports: [ErrorModule, HttpModule, CacheModule],
  providers: [MarketRegimeService],
  exports: [MarketRegimeService],
})
export class MarketRegimeModule {}
