import { Injectable } from '@nestjs/common';

import { OHLCV, Order, upbit } from 'ccxt';

import { ApikeyTypes } from '../apikeys/apikey.type';
import { Apikey } from '../apikeys/entities/apikey.entity';
import { User } from '../user/entities/user.entity';
import { RequestDataDto } from './dto/request-data.dto';
import { BalanceTypes, Candle, OrderTypes } from './upbit.type';

@Injectable()
export class UpbitService {
  public async getClient(user: User) {
    const apikey = await Apikey.findByType(user, ApikeyTypes.UPBIT);

    const client = new upbit({
      apiKey: apikey?.accessKey,
      secret: apikey?.secretKey,
      enableRateLimit: true,
    });

    return client;
  }

  public async getCandles(user: User, requestDataDto: RequestDataDto) {
    const client = await this.getClient(user);

    const candles_m15: OHLCV[] = await client.fetchOHLCV(
      requestDataDto.symbol,
      '15m',
      undefined,
      requestDataDto.countM15,
    );
    const candles_h1: OHLCV[] = await client.fetchOHLCV(requestDataDto.symbol, '1h', undefined, requestDataDto.countH1);
    const candles_h4: OHLCV[] = await client.fetchOHLCV(requestDataDto.symbol, '4h', undefined, requestDataDto.countH4);
    const candles_d1: OHLCV[] = await client.fetchOHLCV(requestDataDto.symbol, '1d', undefined, requestDataDto.countH4);
    const responses: OHLCV[] = [...candles_m15, ...candles_h1, ...candles_h4, ...candles_d1];

    const candles = responses.map(
      (item: OHLCV): Candle => ({
        symbol: requestDataDto.symbol,
        timestamp: new Date(item[0]),
        openPrice: item[1],
        highPrice: item[2],
        lowPrice: item[3],
        closePrice: item[4],
        volume: item[5],
      }),
    );

    return candles;
  }

  public async getBalance(user: User, type: BalanceTypes): Promise<number> {
    const client = await this.getClient(user);
    const balances = await client.fetchBalance();

    return balances[type].free;
  }

  public async order(user: User, type: OrderTypes, rate: number): Promise<Order> {
    const client = await this.getClient(user);
    const balanceKRW = await this.getBalance(user, BalanceTypes.KRW);
    const balanceBTC = await this.getBalance(user, BalanceTypes.BTC);
    const tradePrice = Math.floor(balanceKRW * rate * 0.9995);
    const tradeVolume = balanceBTC * rate * 0.9995;

    switch (type) {
      case OrderTypes.BUY:
        return await client.createOrder('KRW-BTC', 'market', type, 1, tradePrice);

      case OrderTypes.SELL:
        return await client.createOrder('KRW-BTC', 'market', type, tradeVolume);
    }
  }
}
