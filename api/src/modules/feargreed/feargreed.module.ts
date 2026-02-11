import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { ErrorModule } from '../error/error.module';
import { FeargreedController } from './feargreed.controller';
import { FeargreedService } from './feargreed.service';

@Module({
  imports: [ErrorModule, HttpModule, CacheModule],
  controllers: [FeargreedController],
  providers: [FeargreedService],
  exports: [FeargreedService],
})
export class FeargreedModule {}
