import { Module } from '@nestjs/common';

import { TradeExecutionLedgerService } from './trade-execution-ledger.service';

@Module({
  providers: [TradeExecutionLedgerService],
  exports: [TradeExecutionLedgerService],
})
export class TradeExecutionLedgerModule {}
