import { Injectable } from '@nestjs/common';

import { ExchangeService, QuoationService } from 'node-upbit';

import { ApikeyTypes } from '../apikey/apikey.interface';
import { ApikeyService } from '../apikey/apikey.service';
import { RequestDataDto } from './dto/request-data.dto';
import { Candle, CandleResponse } from './upbit.interface';

@Injectable()
export class UpbitService {
  constructor(private readonly apikeyService: ApikeyService) {}

  public getQuatationService() {
    return new QuoationService();
  }

  public async getExchangeService() {
    const apikey = await this.apikeyService.findByType(ApikeyTypes.UPBIT);
    const client = new ExchangeService(apikey?.apiKey, apikey?.secretKey);

    return client;
  }

  public async getCandles(requestDataDto: RequestDataDto) {
    const client = this.getQuatationService();

    const candles_m15: CandleResponse[] = await client.getMinutesCandles({
      minutes: '15',
      marketCoin: requestDataDto.ticker,
      count: requestDataDto.countM15,
    });

    const candles_h1: CandleResponse[] = await client.getMinutesCandles({
      minutes: '60',
      marketCoin: requestDataDto.ticker,
      count: requestDataDto.countH1,
    });

    const candles_h4: CandleResponse[] = await client.getMinutesCandles({
      minutes: '240',
      marketCoin: requestDataDto.ticker,
      count: requestDataDto.countH4,
    });

    const candles_d1: CandleResponse[] = await client.getDayCandles({
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
