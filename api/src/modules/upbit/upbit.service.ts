import { Injectable, Logger } from '@nestjs/common';

import { Balances, OHLCV, Order, upbit } from 'ccxt';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { InferenceDecisionTypes } from '../inference/inference.enum';
import { User } from '../user/entities/user.entity';
import { UpbitConfig } from './entities/upbit-config.entity';
import { OrderTypes } from './upbit.enum';
import { Candle, CandleRequest, OrderRequest, UpbitConfigData } from './upbit.interface';

@Injectable()
export class UpbitService {
  private readonly logger = new Logger(UpbitService.name);

  public async readConfig(user: User): Promise<UpbitConfig> {
    return UpbitConfig.findByUser(user);
  }

  public async createConfig(user: User, data: UpbitConfigData): Promise<UpbitConfig> {
    let config = await this.readConfig(user);

    if (!config) {
      config = new UpbitConfig();
    }

    config.user = user;
    Object.assign(config, data);

    return config.save();
  }

  public async status(user: User): Promise<ApikeyStatus> {
    const apikey = await this.readConfig(user);
    return apikey?.secretKey ? ApikeyStatus.REGISTERED : ApikeyStatus.UNKNOWN;
  }

  public async getServerClient() {
    const client = new upbit({
      apiKey: process.env.UPBIT_ACCESS_KEY!,
      secret: process.env.UPBIT_SECRET_KEY!,
      enableRateLimit: true,
    });

    return client;
  }

  public async getClient(user: User) {
    const apikey = await this.readConfig(user);

    const client = new upbit({
      apiKey: apikey?.accessKey,
      secret: apikey?.secretKey,
      enableRateLimit: true,
    });

    return client;
  }

  public async getCandles(request: CandleRequest): Promise<Candle[]> {
    const client = await this.getServerClient();
    const ticker = `${request.symbol}/${request.market}`;

    const candles = {
      m15: await client.fetchOHLCV(ticker, '15m', undefined, request.candles.m15),
      h1: await client.fetchOHLCV(ticker, '1h', undefined, request.candles.h1),
      h4: await client.fetchOHLCV(ticker, '4h', undefined, request.candles.h4),
      d1: await client.fetchOHLCV(ticker, '1d', undefined, request.candles.d1),
    };

    return [
      ...candles.m15.map((item) => this.mapOHLCVToCandle(item, ticker, 15)),
      ...candles.h1.map((item) => this.mapOHLCVToCandle(item, ticker, 60)),
      ...candles.h4.map((item) => this.mapOHLCVToCandle(item, ticker, 240)),
      ...candles.d1.map((item) => this.mapOHLCVToCandle(item, ticker, 1440)),
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

  public async getSymbolRate(user: User, symbol: string, market: string): Promise<number> {
    const balances = await this.getBalances(user);
    const symbolPrice = this.getPrice(balances, symbol);
    const marketPrice = this.getPrice(balances, market);
    const symbolRate = symbolPrice / (symbolPrice + marketPrice);

    this.logger.debug(`symbolRate: ${symbolRate}`);

    return symbolRate;
  }

  private getPrice(balances: Balances, symbol: string) {
    const info = balances.info.find((item) => item.currency === symbol);

    if (!info) {
      return 0;
    }

    const symbolBalance = Number(info['balance']);
    const symbolAvgBuyPrice = Number(info['avg_buy_price']) || 1;
    const price = symbolBalance * symbolAvgBuyPrice;

    this.logger.debug(`price: ${price}`);

    return price;
  }

  private getVolume(balances: Balances, symbol: string) {
    const balance = balances[symbol];

    if (!balance) {
      return 0;
    }

    const free = Number(balance?.free) || 0;

    this.logger.debug(`free: ${free}`);

    return free;
  }

  private getOrderVolume(balances: Balances, symbol: string, rate: number) {
    return this.getVolume(balances, symbol) * rate * 0.9995;
  }

  public async order(user: User, request: OrderRequest): Promise<Order> {
    const client = await this.getClient(user);
    const balances = await client.fetchBalance();
    const ticker = `${request.symbol}/${request.market}`;
    const tradePrice = this.getOrderVolume(balances, request.market, request.rate);
    const tradeVolume = this.getOrderVolume(balances, request.symbol, request.rate);

    this.logger.debug(`tradePrice: ${tradePrice}`);
    this.logger.debug(`tradeVolume: ${tradeVolume}`);

    switch (request.type) {
      case OrderTypes.BUY:
        return await client.createOrder(ticker, 'market', request.type, 1, tradePrice);

      case OrderTypes.SELL:
        return await client.createOrder(ticker, 'market', request.type, tradeVolume);
    }

    return null;
  }

  public static getOrderType(decision: InferenceDecisionTypes): OrderTypes {
    let orderType: OrderTypes;

    switch (decision) {
      case InferenceDecisionTypes.BUY:
        orderType = OrderTypes.BUY;
        break;

      case InferenceDecisionTypes.SELL:
        orderType = OrderTypes.SELL;
        break;
    }

    return orderType;
  }
}
