import { Injectable } from '@nestjs/common';

import { UpbitService } from '@/modules/upbit/upbit.service';

import { HoldingDto } from './dto/holding.dto';
import { HistoryService } from './history.service';

/**
 * History 테이블 기반 보유 종목 목록 + 표시용 시세/변동률 제공
 */
@Injectable()
export class HoldingsService {
  constructor(
    private readonly historyService: HistoryService,
    private readonly upbitService: UpbitService,
  ) {}

  /**
   * History(히스토리 테이블)에서 보유 종목 목록을 가져와
   * KRW 마켓에 대해 현재가·당일 변동률을 붙여 반환
   */
  async getHoldings(): Promise<HoldingDto[]> {
    const items = await this.historyService.fetchHistory();
    const result: HoldingDto[] = await Promise.all(
      items.map(async (item) => {
        const dto: HoldingDto = {
          symbol: item.symbol,
          category: item.category,
        };
        if (item.symbol.endsWith('/KRW')) {
          try {
            const marketData = await this.upbitService.getMarketData(item.symbol);
            const currentPrice = marketData?.ticker?.last;
            dto.currentPrice = currentPrice;
            const candles1d = marketData?.candles1d || [];
            if (candles1d.length >= 2 && currentPrice != null) {
              const prevClose = Number(candles1d[candles1d.length - 2][4]);
              if (prevClose > 0) {
                dto.dailyChangePct = Number((((currentPrice - prevClose) / prevClose) * 100).toFixed(2));
                dto.dailyChangeAbs = Number((currentPrice - prevClose).toFixed(2));
              }
            }
          } catch {
            // 가격 조회 실패 시 currentPrice/dailyChange 비움
          }
        }
        return dto;
      }),
    );
    return result;
  }
}
