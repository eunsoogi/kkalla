import { Module } from '@nestjs/common';

import { FeargreedModule } from '../feargreed/feargreed.module';
import { HoldingLedgerModule } from '../holding-ledger/holding-ledger.module';
import { MarketIntelligenceModule } from '../market-intelligence/market-intelligence.module';
import { NewsModule } from '../news/news.module';
import { ProfitModule } from '../profit/profit.module';
import { TradeModule } from '../trade/trade.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ProfitModule, TradeModule, HoldingLedgerModule, MarketIntelligenceModule, NewsModule, FeargreedModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
