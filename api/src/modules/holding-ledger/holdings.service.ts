import { Injectable } from '@nestjs/common';

import { CategoryService } from '@/modules/category/category.service';
import { UpbitService } from '@/modules/upbit/upbit.service';
import { User } from '@/modules/user/entities/user.entity';

import { HoldingDto } from './dto/holding.dto';
import { HoldingLedgerService } from './holding-ledger.service';

/**
 * HoldingLedger 테이블 기반 보유 종목 목록 + 표시용 시세/변동률 제공
 * 사용자가 매매 카테고리에서 활성화한 카테고리의 종목만 반환
 */
@Injectable()
export class HoldingsService {
  constructor(
    private readonly holdingLedgerService: HoldingLedgerService,
    private readonly upbitService: UpbitService,
    private readonly categoryService: CategoryService,
  ) {}

  /**
   * HoldingLedger(보유 원장 테이블)에서 보유 종목 목록을 가져와
   * 사용자가 활성화한 카테고리만 필터링한 뒤
   * KRW 마켓에 대해 현재가·당일 변동률을 붙여 반환
   */
  async getHoldings(user: User): Promise<HoldingDto[]> {
    const [items, enabledCategories] = await Promise.all([
      this.holdingLedgerService.fetchHoldingsByUser(user),
      this.categoryService.findEnabledByUser(user),
    ]);

    const enabledSet = new Set(enabledCategories.map((uc) => uc.category));
    const filtered = items.filter((item) => enabledSet.has(item.category));
    const krwSymbols = filtered.filter((item) => item.symbol.endsWith('/KRW')).map((item) => item.symbol);
    const marketDataMap = await this.upbitService.getTickerAndDailyDataBatch(krwSymbols);

    return filtered.map((item) => {
      const dto: HoldingDto = {
        symbol: item.symbol,
        category: item.category,
      };
      if (!item.symbol.endsWith('/KRW')) {
        return dto;
      }

      const marketData = marketDataMap.get(item.symbol);
      if (!marketData) {
        return dto;
      }

      const currentPrice = marketData.ticker?.last;
      dto.currentPrice = currentPrice;
      const candles1d = marketData.candles1d || [];
      if (candles1d.length >= 2 && currentPrice != null) {
        const prevClose = Number(candles1d[candles1d.length - 2][4]);
        if (prevClose > 0) {
          dto.dailyChangePct = Number((((currentPrice - prevClose) / prevClose) * 100).toFixed(2));
          dto.dailyChangeAbs = Number((currentPrice - prevClose).toFixed(2));
        }
      }

      return dto;
    });
  }
}
