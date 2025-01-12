import { Module } from '@nestjs/common';

import { AccumulationModule } from '../accumulation/accumulation.module';
import { BlacklistModule } from '../blacklist/blacklist.module';
import { HistoryModule } from '../history/history.module';
import { InferenceModule } from '../inference/inference.module';
import { NotifyModule } from '../notify/notify.module';
import { ProfitModule } from '../profit/profit.module';
import { SequenceModule } from '../sequence/sequence.module';
import { UpbitModule } from '../upbit/upbit.module';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';

@Module({
  imports: [
    SequenceModule,
    InferenceModule,
    AccumulationModule,
    UpbitModule,
    ProfitModule,
    NotifyModule,
    HistoryModule,
    BlacklistModule,
  ],
  controllers: [TradeController],
  providers: [TradeService],
  exports: [TradeService],
})
export class TradeModule {}
