import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { FeargreedController } from './feargreed.controller';
import { FeargreedService } from './feargreed.service';

@Module({
  imports: [HttpModule],
  controllers: [FeargreedController],
  providers: [FeargreedService],
  exports: [FeargreedService],
})
export class FeargreedModule {}
