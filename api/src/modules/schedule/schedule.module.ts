import { Module } from '@nestjs/common';
import { ScheduleModule as ScheduleModuleRoot } from '@nestjs/schedule';

import { TradeModule } from '../trade/trade.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [ScheduleModuleRoot.forRoot(), TradeModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
