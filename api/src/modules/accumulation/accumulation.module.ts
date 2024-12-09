import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { ErrorModule } from '../error/error.module';
import { AccumulationController } from './accumulation.controller';
import { AccumulationService } from './accumulation.service';

@Module({
  imports: [ErrorModule, HttpModule],
  controllers: [AccumulationController],
  providers: [AccumulationService],
  exports: [AccumulationService],
})
export class AccumulationModule {}
