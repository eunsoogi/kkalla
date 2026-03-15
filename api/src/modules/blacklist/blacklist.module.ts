import { Module } from '@nestjs/common';

import { HoldingLedgerModule } from '../holding-ledger/holding-ledger.module';
import { BlacklistController } from './blacklist.controller';
import { BlacklistService } from './blacklist.service';

@Module({
  imports: [HoldingLedgerModule],
  controllers: [BlacklistController],
  providers: [BlacklistService],
  exports: [BlacklistService],
})
export class BlacklistModule {}
