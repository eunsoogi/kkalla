import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { ErrorModule } from '../error/error.module';
import { FeargreedController } from './feargreed.controller';
import { FeargreedService } from './feargreed.service';

@Module({
  imports: [ErrorModule, HttpModule],
  controllers: [FeargreedController],
  providers: [FeargreedService],
  exports: [FeargreedService],
})
export class FeargreedModule {}
