import { Module } from '@nestjs/common';

import { FeargreedModule } from '../feargreed/feargreed.module';
import { HistoryModule } from '../history/history.module';
import { MarketResearchModule } from '../market-research/market-research.module';
import { NewsModule } from '../news/news.module';
import { ProfitModule } from '../profit/profit.module';
import { TradeModule } from '../trade/trade.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ProfitModule, TradeModule, HistoryModule, MarketResearchModule, NewsModule, FeargreedModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
