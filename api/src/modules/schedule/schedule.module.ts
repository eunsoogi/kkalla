import { Module } from '@nestjs/common';
import { ScheduleModule as ScheduleModuleRoot } from '@nestjs/schedule';

import { AccumulationModule } from '../accumulation/accumulation.module';
import { BlacklistModule } from '../blacklist/blacklist.module';
import { HistoryModule } from '../history/history.module';
import { TradeModule } from '../trade/trade.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [ScheduleModuleRoot.forRoot(), TradeModule, AccumulationModule, BlacklistModule, HistoryModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
