import { Injectable } from '@nestjs/common';

import { Balances, OHLCV, Order, upbit } from 'ccxt';

import { ApikeyTypes } from '../apikeys/apikey.enum';
import { Apikey } from '../apikeys/entities/apikey.entity';
import { User } from '../users/entities/user.entity';
import { OrderTypes } from './upbit.enum';
import { Candle, CandleRequest, OrderRequest } from './upbit.interface';

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

  public async getCandles(user: User, request: CandleRequest): Promise<Candle[]> {
    const client = await this.getClient(user);
    const combinedMarket = `${request.symbol}/${request.market}`;

    const candles = {
      m15: await client.fetchOHLCV(combinedMarket, '15m', undefined, request.candles.m15),
      h1: await client.fetchOHLCV(combinedMarket, '1h', undefined, request.candles.h1),
      h4: await client.fetchOHLCV(combinedMarket, '4h', undefined, request.candles.h4),
      d1: await client.fetchOHLCV(combinedMarket, '1d', undefined, request.candles.d1),
    };

    return [
      ...candles.m15.map((item) => this.mapOHLCVToCandle(item, combinedMarket, 15)),
      ...candles.h1.map((item) => this.mapOHLCVToCandle(item, combinedMarket, 60)),
      ...candles.h4.map((item) => this.mapOHLCVToCandle(item, combinedMarket, 240)),
      ...candles.d1.map((item) => this.mapOHLCVToCandle(item, combinedMarket, 1440)),
    ];
  }

  private mapOHLCVToCandle(ohlcv: OHLCV, market: string, unit: number): Candle {
    return {
      market,
      unit,
      timestamp: new Date(ohlcv[0]),
      openPrice: ohlcv[1],
      highPrice: ohlcv[2],
      lowPrice: ohlcv[3],
      closePrice: ohlcv[4],
      volume: ohlcv[5],
    };
  }

  public async getBalances(user: User): Promise<Balances> {
    const client = await this.getClient(user);
    return client.fetchBalance();
  }

  public async order(user: User, request: OrderRequest): Promise<Order> {
    const client = await this.getClient(user);
    const balances = await client.fetchBalance();
    const combinedMarket = `${request.symbol}/${request.market}`;
    const tradePrice = Math.floor(balances[request.market].free * request.rate * 0.9995);
    const tradeVolume = balances[request.symbol].free * request.rate * 0.9995;

    switch (request.type) {
      case OrderTypes.BUY:
        return await client.createOrder(combinedMarket, 'market', request.type, 1, tradePrice);

      case OrderTypes.SELL:
        return await client.createOrder(combinedMarket, 'market', request.type, tradeVolume);
    }
  }
}
