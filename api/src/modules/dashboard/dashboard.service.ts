import { Injectable } from '@nestjs/common';

import { User } from '@/modules/user/entities/user.entity';

import { HoldingsService } from '../holding-ledger/holdings.service';
import { MarketIntelligenceService } from '../market-intelligence/market-intelligence.service';
import { MarketRegimeService } from '../market-regime/market-regime.service';
import { NewsService } from '../news/news.service';
import { ProfitService } from '../profit/profit.service';
import { TradeService } from '../trade/trade.service';
import { DashboardSummaryDto, DashboardSummarySectionKey } from './dto/dashboard-summary.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly profitService: ProfitService,
    private readonly tradeService: TradeService,
    private readonly holdingsService: HoldingsService,
    private readonly marketIntelligenceService: MarketIntelligenceService,
    private readonly marketRegimeService: MarketRegimeService,
    private readonly newsService: NewsService,
  ) {}

  /**
   * Retrieves summary for the dashboard aggregation flow.
   * @param user - User identifier related to this operation.
   * @returns Asynchronous result produced by the dashboard aggregation flow.
   */
  async getSummary(user: User): Promise<DashboardSummaryDto> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [profitResult, tradesResult, holdingsResult, marketReportsResult, marketRegimeResult, newsResult] =
      await Promise.allSettled([
        this.profitService.getProfit(user),
        this.tradeService.paginateTrades(user, {
          page: 1,
          perPage: 50,
          createdAt: {
            gte: last24h,
            lte: now,
          },
        }),
        this.holdingsService.getHoldings(user),
        this.marketIntelligenceService.getLatestWithPriceChange(10, { mode: 'mixed' }),
        this.marketRegimeService.getSnapshot(),
        this.newsService.getNewsForDashboard(10),
      ]);

    const errors: Partial<Record<DashboardSummarySectionKey, string>> = {};
    const marketRegime = this.resolveSettled(
      marketRegimeResult,
      'marketRegime',
      null,
      errors,
    ) as DashboardSummaryDto['marketRegime'];

    return {
      generatedAt: now.toISOString(),
      marketReports: this.resolveSettled(
        marketReportsResult,
        'marketReports',
        [],
        errors,
      ) as DashboardSummaryDto['marketReports'],
      marketRegime,
      news: this.resolveSettled(newsResult, 'news', [], errors) as DashboardSummaryDto['news'],
      holdings: this.resolveSettled(holdingsResult, 'holdings', [], errors) as DashboardSummaryDto['holdings'],
      trades24h: this.resolveSettled(
        tradesResult,
        'trades24h',
        {
          items: [],
          total: 0,
          page: 1,
          perPage: 50,
          totalPages: 1,
        },
        errors,
      ).items,
      profit: this.resolveSettled(profitResult, 'profit', null, errors) as DashboardSummaryDto['profit'],
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
    };
  }

  /**
   * Normalizes settled for the dashboard aggregation flow.
   * @param result - Input value for result.
   * @param key - Input value for key.
   * @param fallback - Input value for fallback.
   * @param errors - Error captured from a failed operation.
   * @returns Result produced by the dashboard aggregation flow.
   */
  private resolveSettled<T>(
    result: PromiseSettledResult<T>,
    key: DashboardSummarySectionKey,
    fallback: T,
    errors: Partial<Record<DashboardSummarySectionKey, string>>,
  ): T {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    const reason = result.reason;
    errors[key] = reason instanceof Error ? reason.message : String(reason);
    return fallback;
  }
}
