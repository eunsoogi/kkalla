import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { FirechartController } from './firechart.controller';
import { FirechartService } from './firechart.service';

@Module({
  imports: [HttpModule],
  controllers: [FirechartController],
  providers: [FirechartService],
  exports: [FirechartService],
})
export class FirechartModule {}
