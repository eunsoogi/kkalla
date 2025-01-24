import { Injectable, Logger } from '@nestjs/common';

import { Balances, OHLCV, Order, upbit } from 'ccxt';
import { I18nService } from 'nestjs-i18n';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { NotifyService } from '../notify/notify.service';
import { User } from '../user/entities/user.entity';
import { UpbitConfig } from './entities/upbit-config.entity';
import { OrderTypes } from './upbit.enum';
import { AdjustOrderRequest, OrderRequest, UpbitConfigData } from './upbit.interface';

@Injectable()
export class UpbitService {
  private readonly logger = new Logger(UpbitService.name);
  private serverClient: upbit;
  private client: upbit[] = [];
  private readonly MINIMUM_TRADE_PRICE = 5000;

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

  private createClient(apiKey: string, secretKey: string): upbit {
    return new upbit({
      apiKey,
      secret: secretKey,
      enableRateLimit: true,
    });
  }

  public getServerClient(): upbit {
    if (!this.serverClient) {
      this.serverClient = this.createClient(process.env.UPBIT_ACCESS_KEY!, process.env.UPBIT_SECRET_KEY!);
    }
    return this.serverClient;
  }

  public async getClient(user: User): Promise<upbit> {
    if (!this.client[user.id]) {
      const { accessKey, secretKey } = await this.readConfig(user);
      this.client[user.id] = this.createClient(accessKey, secretKey);
    }
    return this.client[user.id];
  }

  public clearClients(): void {
    this.client = [];
  }

  public async getCandles(request: CandleRequest): Promise<OHLCV[]> {
    const client = this.getServerClient();
    return await client.fetchOHLCV(request.ticker, request.timeframe, undefined, request.limit);
  }

  public async getBalances(user: User): Promise<Balances> {
    try {
      const client = await this.getClient(user);
      return await client.fetchBalance();
    } catch {
      this.notifyService.notify(user, this.i18n.t('notify.balance.fail'));
    }

    return null;
  }

  public calculateDiff(balances: Balances, ticker: string, rate: number): number {
    const tickerPrice = this.calculatePrice(balances, ticker);
    const marketPrice = this.calculateTotalPrice(balances);
    const tickerRate = tickerPrice / marketPrice;
    const diff = (rate - tickerRate) / (tickerRate || 1);

    return diff;
  }

  public getBalance(balances: Balances, ticker: string): any {
    return balances.info.find((item) => ticker === `${item.currency}/${item.unit_currency}`) || {};
  }

  public calculatePrice(balances: Balances, ticker: string): number {
    const { balance = 0, avg_buy_price = 0 } = this.getBalance(balances, ticker);
    const totalBalance = parseFloat(balance);
    const avgBuyPrice = parseFloat(avg_buy_price) || 1;
    return totalBalance * avgBuyPrice;
  }

  public calculateTotalPrice(balances: Balances): number {
    return balances.info.reduce((total, item) => {
      const { balance = 0, avg_buy_price = 0 } = item;
      const totalBalance = parseFloat(balance);
      const avgBuyPrice = parseFloat(avg_buy_price) || 1;
      return total + totalBalance * avgBuyPrice;
    }, 0);
  }

  public getOrderType(order: Order): OrderTypes {
    return order.side as OrderTypes;
  }

  public async calculateAmount(order: Order): Promise<number> {
    if (order?.cost) {
      return order.cost;
    } else if (order?.amount) {
      const client = await this.getServerClient();
      const ticker = await client.fetchTicker(order.symbol);
      const amount = order.amount * ticker.last;
      return amount;
    }

    return 0;
  }

  public async calculateProfit(balances: Balances, order: Order, amount: number): Promise<number> {
    const type = this.getOrderType(order);

    if (type === OrderTypes.BUY) return 0;

    const currPrice = await this.getPrice(order.symbol);
    const { avg_buy_price = 0 } = this.getBalance(balances, order.symbol);
    const avgBuyPrice = parseFloat(avg_buy_price) || 1;
    const rate = currPrice / avgBuyPrice;
    const profit = amount - amount / rate;

    return profit;
  }

  public async isTickerExist(ticker: string): Promise<boolean> {
    const client = await this.getServerClient();
    let markets = client.markets;
    if (!markets) {
      markets = await client.loadMarkets();
    }
    return ticker in markets;
  }

  public async getPrice(ticker: string): Promise<number> {
    const client = await this.getServerClient();
    const info = await client.fetchTicker(ticker);
    return info.last;
  }

  public getVolume(balances: Balances, symbol: string): number {
    const balance = balances[symbol];
    const free = Number(balance?.free) || 0;

    this.logger.debug(`free: ${free}`);

    return free;
  }

  public async order(user: User, request: OrderRequest): Promise<Order | null> {
    try {
      const client = await this.getClient(user);

      switch (request.type) {
        case OrderTypes.BUY:
          return await client.createOrder(request.ticker, 'market', request.type, 1, request.amount);

        case OrderTypes.SELL:
          return await client.createOrder(request.ticker, 'market', request.type, request.amount);
      }
    } catch (error) {
      this.logger.error(this.i18n.t('logging.order.fail', { args: { id: user.id } }), error);
      this.notifyService.notify(user, this.i18n.t('notify.order.fail', { args: request }));
    }

    return null;
  }

  public async adjustOrder(user: User, request: AdjustOrderRequest): Promise<Order | null> {
    this.logger.log(this.i18n.t('logging.order.start', { args: { id: user.id } }));

    const { ticker, diff, balances } = request;
    const [symbol] = ticker.split('/');
    const tickerExist = await this.isTickerExist(ticker);

    if (!tickerExist) {
      return null;
    }

    try {
      const currPrice = await this.getPrice(ticker);
      const tickerPrice = this.calculatePrice(balances, ticker);
      const tickerVolume = this.getVolume(balances, symbol);
      const marketPrice = this.calculateTotalPrice(balances);
      const tradePrice = (tickerPrice || marketPrice) * diff * 0.9995;
      const tradeVolume = tickerVolume * diff * -1;

      // 매수해야 할 경우
      if (diff > 0 && tradePrice > this.MINIMUM_TRADE_PRICE) {
        return await this.order(user, {
          ticker,
          type: OrderTypes.BUY,
          amount: tradePrice,
        });
      }
      // 매도해야 할 경우
      else if (diff < 0 && tradeVolume * currPrice > this.MINIMUM_TRADE_PRICE) {
        return await this.order(user, {
          ticker,
          type: OrderTypes.SELL,
          amount: tradeVolume,
        });
      }
    } catch (error) {
      this.logger.error(this.i18n.t('logging.order.fail', { args: { id: user.id } }), error);
      this.notifyService.notify(user, this.i18n.t('notify.order.fail', { args: request }));
    }

    return null;
  }
}

export interface CandleRequest {
  ticker: string;
  since?: number;
  limit?: number;
  timeframe: string;
}
