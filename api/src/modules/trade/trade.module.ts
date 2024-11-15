import { Module } from '@nestjs/common';

import { InferenceModule } from '../inference/inference.module';
import { NotifyModule } from '../notify/notify.module';
import { SequenceModule } from '../sequence/sequence.module';
import { UpbitModule } from '../upbit/upbit.module';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';

@Module({
  imports: [SequenceModule, InferenceModule, UpbitModule, NotifyModule],
  controllers: [TradeController],
  providers: [TradeService],
  exports: [TradeService],
})
export class TradeModule {}
