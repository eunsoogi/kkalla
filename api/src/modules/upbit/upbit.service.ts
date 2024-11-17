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
    const config = (await this.readConfig(user)) || new UpbitConfig();
    config.user = user;
    Object.assign(config, data);
    return config.save();
  }

  public async status(user: User): Promise<ApikeyStatus> {
    const apikey = await this.readConfig(user);
    return apikey?.secretKey ? ApikeyStatus.REGISTERED : ApikeyStatus.UNKNOWN;
  }

  private async createClient(apiKey: string, secretKey: string) {
    return new upbit({
      apiKey,
      secret: secretKey,
      enableRateLimit: true,
    });
  }

  public async getServerClient() {
    return this.createClient(process.env.UPBIT_ACCESS_KEY!, process.env.UPBIT_SECRET_KEY!);
  }

  public async getClient(user: User) {
    const { accessKey, secretKey } = await this.readConfig(user);
    return this.createClient(accessKey, secretKey);
  }

  public async getCandles(request: CandleRequest): Promise<Candle[]> {
    const client = await this.getServerClient();
    const ticker = `${request.symbol}/${request.market}`;
    const candleIntervals = ['15m', '1h', '4h', '1d'];
    const candles = await Promise.all(
      candleIntervals.map((interval) => client.fetchOHLCV(ticker, interval, undefined, request.candles[interval])),
    );

    return candles.flatMap((items, index) =>
      items.map((item) => this.mapOHLCVToCandle(item, ticker, [15, 60, 240, 1440][index])),
    );
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

  public async getOrderRatio(user: User, symbol: string): Promise<number> {
    const balances = await this.getBalances(user);
    const orderRatio = this.calculateOrderRatio(balances, symbol);

    this.logger.debug(`orderRatio: ${orderRatio}`);

    return orderRatio;
  }

  private calculateOrderRatio(balances: Balances, symbol: string): number {
    const symbolPrice = this.calculatePrice(balances, symbol);
    const marketPrice = this.calculateTotalPrice(balances);
    return symbolPrice / marketPrice;
  }

  private calculatePrice(balances: Balances, symbol: string): number {
    const info = balances.info.find((item) => item.currency === symbol) || {};
    return (Number(info['balance']) || 0) * (Number(info['avg_buy_price']) || 1);
  }

  private calculateTotalPrice(balances: Balances): number {
    return balances.info.reduce((total, item) => {
      const balance = Number(item['balance']) || 0;
      const avgBuyPrice = Number(item['avg_buy_price']) || 1;
      return total + balance * avgBuyPrice;
    }, 0);
  }

  private getVolume(balances: Balances, symbol: string): number {
    const balance = balances[symbol];
    const free = Number(balance?.free) || 0;

    this.logger.debug(`free: ${free}`);

    return free;
  }

  private getOrderVolume(balances: Balances, symbol: string, orderRatio: number): number {
    return this.getVolume(balances, symbol) * orderRatio * 0.9995;
  }

  public async order(user: User, request: OrderRequest): Promise<Order> {
    const client = await this.getClient(user);
    const balances = await client.fetchBalance();
    const ticker = `${request.symbol}/${request.market}`;
    const tradePrice = this.getOrderVolume(balances, request.market, request.orderRatio);
    const tradeVolume = this.getOrderVolume(balances, request.symbol, request.orderRatio);

    this.logger.debug(`tradePrice: ${tradePrice}`);
    this.logger.debug(`tradeVolume: ${tradeVolume}`);

    return request.type === OrderTypes.BUY
      ? await client.createOrder(ticker, 'market', request.type, 1, tradePrice)
      : await client.createOrder(ticker, 'market', request.type, tradeVolume);
  }

  public static getOrderType(decision: InferenceDecisionTypes): OrderTypes | null {
    switch (decision) {
      case InferenceDecisionTypes.BUY:
        return OrderTypes.BUY;

      case InferenceDecisionTypes.SELL:
        return OrderTypes.SELL;
    }

    return null;
  }
}
