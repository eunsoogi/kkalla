import { Module } from '@nestjs/common';

import { InferenceModule } from '../inference/inference.module';
import { UpbitModule } from '../upbit/upbit.module';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';

@Module({
  imports: [InferenceModule, UpbitModule],
  providers: [TradeService],
  controllers: [TradeController],
})
export class TradeModule {}
