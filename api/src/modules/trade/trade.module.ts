import { Module } from '@nestjs/common';

import { InferenceModule } from '../inference/inference.module';
import { UpbitModule } from '../upbit/upbit.module';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';

@Module({
  imports: [InferenceModule, UpbitModule],
  controllers: [TradeController],
  providers: [TradeService],
  exports: [TradeService],
})
export class TradeModule {}
