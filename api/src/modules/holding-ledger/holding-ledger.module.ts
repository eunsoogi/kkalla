import { Module } from '@nestjs/common';

import { CategoryModule } from '../category/category.module';
import { UpbitModule } from '../upbit/upbit.module';
import { HoldingLedgerService } from './holding-ledger.service';
import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';

@Module({
  imports: [UpbitModule, CategoryModule],
  controllers: [HoldingsController],
  providers: [HoldingLedgerService, HoldingsService],
  exports: [HoldingLedgerService, HoldingsService],
})
export class HoldingLedgerModule {}
