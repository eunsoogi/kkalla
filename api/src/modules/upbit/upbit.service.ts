import { Injectable, Logger } from '@nestjs/common';

import { Balances, Order, upbit } from 'ccxt';
import { I18nService } from 'nestjs-i18n';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { NotifyService } from '../notify/notify.service';
import { User } from '../user/entities/user.entity';
import { UpbitConfig } from './entities/upbit-config.entity';
import { OrderTypes } from './upbit.enum';
import { AdjustOrderRequest, CandleRequest, CompactCandle, OrderRequest, UpbitConfigData } from './upbit.interface';

@Injectable()
export class UpbitService {
  private readonly logger = new Logger(UpbitService.name);
  private serverClient: upbit;
  private client: upbit[] = [];

  constructor(
    private readonly notifyService: NotifyService,
    private readonly i18n: I18nService,
  ) {}

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
    if (!this.serverClient) {
      this.serverClient = await this.createClient(process.env.UPBIT_ACCESS_KEY!, process.env.UPBIT_SECRET_KEY!);
    }
    return this.serverClient;
  }

  public async getClient(user: User) {
    if (!this.client[user.id]) {
      const { accessKey, secretKey } = await this.readConfig(user);
      this.client[user.id] = this.createClient(accessKey, secretKey);
    }
    return this.client[user.id];
  }

  public async getCandles(request: CandleRequest): Promise<CompactCandle> {
    const client = await this.getServerClient();
    const candleIntervals = ['15m', '1h', '4h', '1d'];

    const candles: CompactCandle = {
      ticker: request.ticker,
      series: await Promise.all(
        candleIntervals.map(async (interval) => ({
          interval,
          data: await client.fetchOHLCV(request.ticker, interval, undefined, request.candles[interval]),
        })),
      ),
    };

    return candles;
  }

  public async getBalances(user: User): Promise<Balances> {
    const client = await this.getClient(user);

    try {
      return client.fetchBalance();
    } catch {
      this.notifyService.notify(user, this.i18n.t('notify.balance.fail'));
    }
  }

  public calculatePrice(balances: Balances, ticker: string): number {
    const {
      balance = 0,
      locked = 0,
      avg_buy_price = 0,
    } = balances.info.find((item) => ticker === `${item.currency}/${item.unit_currency}`) || {};

    const totalBalance = parseFloat(balance) + parseFloat(locked);
    const averageBuyPrice = parseFloat(avg_buy_price) || 1;
    return totalBalance * averageBuyPrice;
  }

  public calculateTotalPrice(balances: Balances): number {
    return balances.info.reduce((total, item) => {
      const { balance = 0, locked = 0, avg_buy_price = 0 } = item;
      const totalBalance = parseFloat(balance) + parseFloat(locked);
      const averageBuyPrice = parseFloat(avg_buy_price) || 1;
      return total + totalBalance * averageBuyPrice;
    }, 0);
  }

  public getVolume(balances: Balances, symbol: string): number {
    const balance = balances[symbol];
    const free = Number(balance?.free) || 0;

    this.logger.debug(`free: ${free}`);

    return free;
  }

  public async order(user: User, request: OrderRequest): Promise<Order | null> {
    const client = await this.getClient(user);

    switch (request.type) {
      case OrderTypes.BUY:
        return client.createOrder(request.ticker, 'market', request.type, 1, request.amount);

      case OrderTypes.SELL:
        return client.createOrder(request.ticker, 'market', request.type, request.amount);
    }
  }

  public async adjustOrder(user: User, request: AdjustOrderRequest): Promise<Order | null> {
    this.logger.log(this.i18n.t('logging.order.start', { args: { id: user.id } }));

    try {
      const ticker = request.ticker;
      const [symbol] = ticker.split('/');
      const tickerVolume = this.getVolume(request.balances, symbol);
      const tickerPrice = this.calculatePrice(request.balances, ticker);

      // 매수해야할 경우
      if (request.diff > 0) {
        return this.order(user, {
          ticker,
          type: OrderTypes.BUY,
          amount: tickerPrice * request.diff * 0.9995,
        });
      }
      // 매도해야할 경우
      else if (request.diff < 0) {
        return this.order(user, {
          ticker,
          type: OrderTypes.SELL,
          amount: tickerVolume * request.diff * -1,
        });
      }
    } catch (error) {
      this.logger.error(this.i18n.t('logging.order.fail', { args: { id: user.id } }), error);
      this.notifyService.notify(user, this.i18n.t('notify.order.fail'));
    }

    return null;
  }

  public getDiff(balances: Balances, ticker: string, rate: number): number {
    const tickerPrice = this.calculatePrice(balances, ticker);
    const marketPrice = this.calculateTotalPrice(balances);
    const tickerRate = tickerPrice / marketPrice;
    const orderRate = rate;
    const diff = (orderRate - tickerRate) / tickerRate;

    return diff;
  }
}
