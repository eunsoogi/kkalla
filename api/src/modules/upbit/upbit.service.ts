import { Injectable, Logger } from '@nestjs/common';

import { AuthenticationError, Balances, Order, upbit } from 'ccxt';
import { I18nService } from 'nestjs-i18n';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { TwoPhaseRetryOptions } from '../error/error.interface';
import { ErrorService } from '../error/error.service';
import { NotifyService } from '../notify/notify.service';
import { Schedule } from '../schedule/entities/schedule.entity';
import { User } from '../user/entities/user.entity';
import { UpbitConfig } from './entities/upbit-config.entity';
import { OrderTypes } from './upbit.enum';
import { AdjustOrderRequest, KrwMarketData, OrderRequest, UpbitConfigData } from './upbit.interface';

@Injectable()
export class UpbitService {
  private readonly logger = new Logger(UpbitService.name);
  private serverClient: upbit;
  private client: upbit[] = [];
  private readonly MINIMUM_TRADE_PRICE = 5000;
  private readonly MAX_PRECISION = 8;

  // API 호출에 대한 2단계 재시도 옵션
  private readonly retryOptions: TwoPhaseRetryOptions = {
    firstPhase: {
      maxRetries: 5,
      retryDelay: 1000, // 1초 간격
    },
    secondPhase: {
      maxRetries: 3,
      retryDelay: 60000, // 1분 간격
    },
  };

  constructor(
    private readonly i18n: I18nService,
    private readonly errorService: ErrorService,
    private readonly notifyService: NotifyService,
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

  public async getServerClient(): Promise<upbit> {
    if (!this.serverClient) {
      const client = this.createClient(process.env.UPBIT_ACCESS_KEY!, process.env.UPBIT_SECRET_KEY!);

      try {
        // API 키 만료 확인
        await client.fetchBalance();
        this.serverClient = client;
      } catch (error) {
        // API 키가 만료됐다면
        if (error instanceof AuthenticationError) {
          this.logger.error(this.i18n.t('logging.upbit.apikey.server_expired'));
          this.notifyService.notifyServer(this.i18n.t('notify.upbit.apikey.server_expired'));
        }

        throw error;
      }
    }

    return this.serverClient;
  }

  public async getClient(user: User): Promise<upbit> {
    if (!this.client[user.id]) {
      const { accessKey, secretKey } = await this.readConfig(user);
      const client = this.createClient(accessKey, secretKey);

      try {
        // API 키 만료 확인
        await client.fetchBalance();
        this.client[user.id] = client;
      } catch (error) {
        // API 키가 만료됐다면
        if (error instanceof AuthenticationError) {
          this.logger.warn(this.i18n.t('logging.upbit.apikey.user_expired', { args: { id: user.id } }));

          // 스케줄 비활성화
          const schedule = await Schedule.findByUser(user);

          if (schedule) {
            schedule.enabled = false;
            await schedule.save();
            this.logger.log(this.i18n.t('logging.upbit.apikey.schedule_disabled', { args: { id: user.id } }));
          }

          this.notifyService.notify(user, this.i18n.t('notify.upbit.apikey.user_expired'));
        }

        throw error;
      }
    }

    return this.client[user.id];
  }

  public clearClients(): void {
    this.client = [];
  }

  public async getBalances(user: User): Promise<Balances> {
    try {
      const client = await this.getClient(user);

      const balances = await this.errorService.retryWithFallback(async () => {
        return await client.fetchBalance();
      }, this.retryOptions);

      return balances;
    } catch {
      this.notifyService.notify(user, this.i18n.t('notify.balance.fail'));
    }

    return null;
  }

  public calculateDiff(balances: Balances, symbol: string, rate: number): number {
    const symbolPrice = this.calculatePrice(balances, symbol);
    const marketPrice = this.calculateTotalPrice(balances);
    const symbolRate = symbolPrice / marketPrice;
    const diff = (rate - symbolRate) / (symbolRate || 1);

    return diff;
  }

  public getBalance(balances: Balances, symbol: string): any {
    return balances.info.find((item) => symbol === `${item.currency}/${item.unit_currency}`) || {};
  }

  public calculatePrice(balances: Balances, symbol: string): number {
    const { balance = 0, avg_buy_price = 0 } = this.getBalance(balances, symbol);
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

      const ticker = await this.errorService.retryWithFallback(async () => {
        return await client.fetchTicker(order.symbol);
      }, this.retryOptions);

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

  public async isSymbolExist(symbol: string): Promise<boolean> {
    const client = await this.getServerClient();
    let markets = client.markets;

    if (!markets) {
      markets = await this.errorService.retryWithFallback(async () => {
        return await client.loadMarkets();
      }, this.retryOptions);
    }

    return symbol in markets;
  }

  public async getPrice(symbol: string): Promise<number> {
    const client = await this.getServerClient();

    const info = await this.errorService.retryWithFallback(async () => {
      return await client.fetchTicker(symbol);
    }, this.retryOptions);

    return info.last;
  }

  public getVolume(balances: Balances, symbol: string): number {
    const balance = balances[symbol];
    const free = Number(balance?.free) || 0;

    return free;
  }

  public async order(user: User, request: OrderRequest): Promise<Order | null> {
    const deductionAmount = 1 / 10 ** this.MAX_PRECISION;

    try {
      const client = await this.getClient(user);
      let retries = 0;

      return await this.errorService.retry(
        async () => {
          const amount = request.amount - deductionAmount * retries++;

          switch (request.type) {
            case OrderTypes.BUY:
              return await client.createOrder(request.symbol, 'market', request.type, 1, amount);

            case OrderTypes.SELL:
              return await client.createOrder(request.symbol, 'market', request.type, amount);
          }
        },
        {
          maxRetries: 10,
          retryDelay: 1000,
        },
      );
    } catch (error) {
      this.logger.error(this.i18n.t('logging.order.fail', { args: { id: user.id } }), error);
      this.notifyService.notify(user, this.i18n.t('notify.order.fail', { args: request }));
    }

    return null;
  }

  public async adjustOrder(user: User, request: AdjustOrderRequest): Promise<Order | null> {
    this.logger.log(this.i18n.t('logging.order.start', { args: { id: user.id } }));

    const { symbol, diff, balances } = request;
    const [baseAsset] = symbol.split('/');
    const symbolExist = await this.isSymbolExist(symbol);

    if (!symbolExist) {
      return null;
    }

    try {
      const currPrice = await this.getPrice(symbol);
      const symbolPrice = this.calculatePrice(balances, symbol);
      const symbolVolume = this.getVolume(balances, baseAsset);
      const marketPrice = this.calculateTotalPrice(balances);
      const tradePrice = (symbolPrice || marketPrice) * Math.abs(diff) * 0.9995;
      const tradeVolume = symbolVolume * Math.abs(diff);

      // 매수해야 할 경우
      if (diff > 0 && tradePrice > this.MINIMUM_TRADE_PRICE) {
        return await this.order(user, {
          symbol,
          type: OrderTypes.BUY,
          amount: tradePrice,
        });
      }
      // 매도해야 할 경우
      else if (diff < 0 && tradeVolume * currPrice > this.MINIMUM_TRADE_PRICE) {
        return await this.order(user, {
          symbol,
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

  /**
   * KRW 마켓의 모든 종목을 가져옵니다
   */
  public async getAllKrwMarkets(): Promise<string[]> {
    const client = await this.getServerClient();

    try {
      const markets = await this.errorService.retryWithFallback(async () => {
        return await client.loadMarkets();
      }, this.retryOptions);

      // KRW 마켓만 필터링
      const krwMarkets = Object.keys(markets).filter((symbol) => symbol.endsWith('/KRW'));

      this.logger.log(this.i18n.t('logging.upbit.markets.found', { args: { count: krwMarkets.length } }));
      return krwMarkets;
    } catch (error) {
      this.logger.error(this.i18n.t('logging.upbit.markets.load_failed'), error);
      throw error;
    }
  }

  /**
   * 특정 종목의 시장 데이터를 가져옵니다
   */
  public async getMarketData(symbol: string): Promise<KrwMarketData> {
    const client = await this.getServerClient();

    try {
      const [ticker, candles1d, candles1w, candles1h, candles4h] = await Promise.all([
        this.errorService.retryWithFallback(async () => {
          return await client.fetchTicker(symbol);
        }, this.retryOptions),

        this.errorService.retryWithFallback(async () => {
          return await client.fetchOHLCV(symbol, '1d', undefined, 200);
        }, this.retryOptions),

        this.errorService.retryWithFallback(async () => {
          return await client.fetchOHLCV(symbol, '1w', undefined, 52);
        }, this.retryOptions),

        this.errorService.retryWithFallback(async () => {
          return await client.fetchOHLCV(symbol, '1h', undefined, 100);
        }, this.retryOptions),

        this.errorService.retryWithFallback(async () => {
          return await client.fetchOHLCV(symbol, '4h', undefined, 60);
        }, this.retryOptions),
      ]);

      return {
        symbol,
        ticker,
        candles1d,
        candles1w,
        candles1h,
        candles4h,
      };
    } catch (error) {
      this.logger.error(this.i18n.t('logging.upbit.market.load_failed', { args: { symbol } }), error);
      throw error;
    }
  }
}
