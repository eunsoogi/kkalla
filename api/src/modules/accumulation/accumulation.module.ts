import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { AccumulationController } from './accumulation.controller';
import { AccumulationService } from './accumulation.service';

@Module({
  imports: [HttpModule],
  controllers: [AccumulationController],
  providers: [AccumulationService],
  exports: [AccumulationService],
})
export class AccumulationModule {}
