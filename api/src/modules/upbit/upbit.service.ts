import { Injectable } from '@nestjs/common';

import { QuoationService } from 'node-upbit';

import { RequestDataDto } from './dto/request-data.dto';
import { Candle, CandleResponse } from './upbit.interface';

@Injectable()
export class UpbitService {
  private readonly quotationService: QuoationService = new QuoationService();

  async getCandles(requestDataDto: RequestDataDto) {
    const candles_m15: CandleResponse[] = await this.quotationService.getMinutesCandles({
      minutes: '15',
      marketCoin: requestDataDto.ticker,
      count: requestDataDto.countM15,
    });

    const candles_h1: CandleResponse[] = await this.quotationService.getMinutesCandles({
      minutes: '60',
      marketCoin: requestDataDto.ticker,
      count: requestDataDto.countH1,
    });

    const candles_h4: CandleResponse[] = await this.quotationService.getMinutesCandles({
      minutes: '240',
      marketCoin: requestDataDto.ticker,
      count: requestDataDto.countH4,
    });

    const candles_d1: CandleResponse[] = await this.quotationService.getDayCandles({
      marketCoin: requestDataDto.ticker,
      count: requestDataDto.countD1,
    });

    const responses: CandleResponse[] = [...candles_m15, ...candles_h1, ...candles_h4, ...candles_d1];

    const candles = responses.map(
      (item: CandleResponse): Candle => ({
        market: item.market,
        candleDateTimeUTC: item.candle_date_time_utc,
        candleDateTimeKST: item.candle_date_time_kst,
        timestamp: item.timestamp,
        openingPrice: item.opening_price,
        highPrice: item.high_price,
        lowPrice: item.low_price,
        tradePrice: item.trade_price,
        prevClosingPrice: item?.prev_closing_price,
        changePrice: item?.change_price,
        changeRate: item?.change_rate,
        candleAccTradePrice: item.candle_acc_trade_price,
        candleAccTradeVolume: item.candle_acc_trade_volume,
        unit: item?.unit ?? 1440,
      }),
    );

    return candles;
  }
}
