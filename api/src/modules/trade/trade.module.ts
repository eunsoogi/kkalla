import { Module } from '@nestjs/common';

import { ErrorModule } from '../error/error.module';
import { TradeCostCalibrationService } from './trade-cost-calibration.service';
import { TradeController } from './trade.controller';
import { TradeService } from './trade.service';

/**
 * 거래 조회 전용 모듈.
 *
 * - 거래 실행 기능은 Allocation 및 Volatility 모듈로 이동됨
 * - 거래 조회 기능만 제공
 */
@Module({
  imports: [ErrorModule],
  controllers: [TradeController],
  providers: [TradeService, TradeCostCalibrationService],
  exports: [TradeService, TradeCostCalibrationService],
})
export class TradeModule {}
