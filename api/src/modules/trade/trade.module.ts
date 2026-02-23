import { Module } from '@nestjs/common';

import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';

/**
 * 거래 조회 전용 모듈.
 *
 * - 거래 실행 기능은 Allocation 및 Volatility 모듈로 이동됨
 * - 거래 조회 기능만 제공
 */
@Module({
  controllers: [TradeController],
  providers: [TradeService],
  exports: [TradeService],
})
export class TradeModule {}
