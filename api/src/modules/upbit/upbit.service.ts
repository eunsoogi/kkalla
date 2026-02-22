import { Injectable, Logger } from '@nestjs/common';

import { AuthenticationError, Balances, Order, upbit } from 'ccxt';
import { I18nService } from 'nestjs-i18n';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { CacheService } from '../cache/cache.service';
import { TwoPhaseRetryOptions } from '../error/error.interface';
import { ErrorService } from '../error/error.service';
import { NotifyService } from '../notify/notify.service';
import { Schedule } from '../schedule/entities/schedule.entity';
import { User } from '../user/entities/user.entity';
import { UpbitConfig } from './entities/upbit-config.entity';
import { UPBIT_MINIMUM_TRADE_PRICE } from './upbit.constant';
import { OrderTypes } from './upbit.enum';
import {
  AdjustOrderRequest,
  KrwMarketData,
  KrwTickerDailyData,
  OrderRequest,
  UpbitConfigData,
} from './upbit.interface';

@Injectable()
export class UpbitService {
  private readonly logger = new Logger(UpbitService.name);
  private serverClient: upbit;
  private client: upbit[] = [];
  private readonly MAX_PRECISION = 8;
  private readonly MINUTE_OPEN_VALUE_CACHE_TTL_SECONDS = 60 * 60 * 24;
  private readonly MINUTE_OPEN_NULL_CACHE_TTL_SECONDS = 60;

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
    private readonly cacheService: CacheService,
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
          await this.notifyService.notifyServer(this.i18n.t('notify.upbit.apikey.server_expired'));
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

          await this.notifyService.notify(user, this.i18n.t('notify.upbit.apikey.user_expired'));
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
      await this.notifyService.notify(user, this.i18n.t('notify.balance.fail'));
    }

    return null;
  }

  public calculateDiff(balances: Balances, symbol: string, targetWeight: number): number {
    const symbolPrice = this.calculatePrice(balances, symbol);
    const marketPrice = this.calculateTotalPrice(balances);
    const currentWeight = symbolPrice / marketPrice;
    const diff = (targetWeight - currentWeight) / (currentWeight || 1);

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

  private getTotalBalanceAmount(item: any): number {
    const balance = parseFloat(item?.balance || 0);
    const locked = parseFloat(item?.locked || 0);
    return balance + locked;
  }

  private getTradableBalanceAmount(item: any): number {
    return parseFloat(item?.balance || 0);
  }

  /**
   * 평균매수가가 아닌 현재가 기준으로 계좌 총 평가금액을 계산합니다.
   * - `balance + locked` 기준으로 전체 익스포저를 계산
   * - KRW는 잔고 자체를 사용
   * - 코인은 최신 시세(last) * 수량을 사용
   */
  public async calculateTotalMarketValue(balances: Balances, orderableSymbols?: Set<string>): Promise<number> {
    const values = await Promise.all(
      balances.info.map(async (item) => {
        const totalBalance = this.getTotalBalanceAmount(item);
        if (totalBalance <= 0) {
          return 0;
        }

        if (item.currency === item.unit_currency) {
          return totalBalance;
        }

        const symbol = `${item.currency}/${item.unit_currency}`;
        if (orderableSymbols && !orderableSymbols.has(symbol)) {
          return 0;
        }

        try {
          if (!(await this.isSymbolExist(symbol))) {
            return 0;
          }
          const currPrice = await this.getPrice(symbol);
          return totalBalance * currPrice;
        } catch {
          const avgBuyPrice = parseFloat(item.avg_buy_price || 0);
          return totalBalance * avgBuyPrice;
        }
      }),
    );

    return values.reduce((acc, value) => acc + value, 0);
  }

  /**
   * 거래 가능한 잔고(`balance`)만 기준으로 계좌 총 평가금액을 계산합니다.
   * - KRW는 잔고 자체를 사용
   * - 코인은 최신 시세(last) * 수량을 사용
   */
  public async calculateTradableMarketValue(balances: Balances, orderableSymbols?: Set<string>): Promise<number> {
    const values = await Promise.all(
      balances.info.map(async (item) => {
        const tradableBalance = this.getTradableBalanceAmount(item);
        if (tradableBalance <= 0) {
          return 0;
        }

        if (item.currency === item.unit_currency) {
          return tradableBalance;
        }

        const symbol = `${item.currency}/${item.unit_currency}`;
        if (orderableSymbols && !orderableSymbols.has(symbol)) {
          return 0;
        }

        try {
          if (!(await this.isSymbolExist(symbol))) {
            return 0;
          }
          const currPrice = await this.getPrice(symbol);
          return tradableBalance * currPrice;
        } catch {
          const avgBuyPrice = parseFloat(item.avg_buy_price || 0);
          return tradableBalance * avgBuyPrice;
        }
      }),
    );

    return values.reduce((acc, value) => acc + value, 0);
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
    const priceRatio = currPrice / avgBuyPrice;
    const profit = amount - amount / priceRatio;

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
    const cacheKey = `upbit:price:${symbol}`;
    const cached = await this.cacheService.get<number>(cacheKey);
    if (cached != null) {
      return cached;
    }

    const client = await this.getServerClient();

    const info = await this.errorService.retryWithFallback(async () => {
      return await client.fetchTicker(symbol);
    }, this.retryOptions);

    const last = info.last;
    // 짧은 시간 동안만 캐시 (예: 10초)
    await this.cacheService.set(cacheKey, last, 10);

    return last;
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
      await this.notifyService.notify(user, this.i18n.t('notify.order.fail', { args: request }));
    }

    return null;
  }

  public async adjustOrder(user: User, request: AdjustOrderRequest): Promise<Order | null> {
    this.logger.log(this.i18n.t('logging.order.start', { args: { id: user.id } }));

    const { symbol, diff, balances, marketPrice: precomputedMarketPrice } = request;
    const [baseAsset] = symbol.split('/');
    const symbolExist = await this.isSymbolExist(symbol);

    if (!symbolExist) {
      return null;
    }

    try {
      const currPrice = await this.getPrice(symbol);
      const symbolTradableVolume = this.getVolume(balances, baseAsset);
      const symbolMarketPrice = symbolTradableVolume * currPrice;
      const marketPriceCandidate = precomputedMarketPrice ?? 0;
      const marketPrice =
        Number.isFinite(marketPriceCandidate) && marketPriceCandidate > 0
          ? marketPriceCandidate
          : this.calculateTotalPrice(balances);
      const tradePrice = (symbolMarketPrice || marketPrice) * Math.abs(diff) * 0.9995;
      const tradeVolume = symbolTradableVolume * Math.abs(diff);

      // 매수해야 할 경우
      if (diff > 0 && tradePrice > UPBIT_MINIMUM_TRADE_PRICE) {
        return await this.order(user, {
          symbol,
          type: OrderTypes.BUY,
          amount: tradePrice,
        });
      }
      // 매도해야 할 경우
      else if (diff < 0 && tradeVolume * currPrice > UPBIT_MINIMUM_TRADE_PRICE) {
        return await this.order(user, {
          symbol,
          type: OrderTypes.SELL,
          amount: tradeVolume,
        });
      }
    } catch (error) {
      this.logger.error(this.i18n.t('logging.order.fail', { args: { id: user.id } }), error);
      await this.notifyService.notify(user, this.i18n.t('notify.order.fail', { args: request }));
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
    const cacheKey = `upbit:market-data:${symbol}`;
    const cached = await this.cacheService.get<KrwMarketData>(cacheKey);
    if (cached) {
      return cached;
    }

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

      const data: KrwMarketData = {
        symbol,
        ticker,
        candles1d,
        candles1w,
        candles1h,
        candles4h,
      };

      // 시장 데이터는 상대적으로 덜 자주 변하므로 조금 더 길게 캐시 (예: 60초)
      await this.cacheService.set(cacheKey, data, 60);

      return data;
    } catch (error) {
      this.logger.error(this.i18n.t('logging.upbit.market.load_failed', { args: { symbol } }), error);
      throw error;
    }
  }

  /**
   * 대시보드용 경량 시장 데이터(현재가 + 일봉) 조회
   */
  public async getTickerAndDailyData(symbol: string): Promise<KrwTickerDailyData> {
    const cacheKey = `upbit:market-lite:${symbol}`;
    const cached = await this.cacheService.get<KrwTickerDailyData>(cacheKey);
    if (cached) {
      return cached;
    }

    const client = await this.getServerClient();

    const [ticker, candles1d] = await Promise.all([
      this.errorService.retryWithFallback(async () => {
        return await client.fetchTicker(symbol);
      }, this.retryOptions),
      this.errorService.retryWithFallback(async () => {
        return await client.fetchOHLCV(symbol, '1d', undefined, 200);
      }, this.retryOptions),
    ]);

    const data: KrwTickerDailyData = {
      symbol,
      ticker,
      candles1d,
    };
    await this.cacheService.set(cacheKey, data, 60);

    return data;
  }

  /**
   * 대시보드용 경량 시장 데이터를 심볼 단위로 일괄 조회
   */
  public async getTickerAndDailyDataBatch(symbols: string[]): Promise<Map<string, KrwTickerDailyData>> {
    const uniqueSymbols = Array.from(new Set(symbols.filter((symbol) => !!symbol)));
    const entries = await Promise.all(
      uniqueSymbols.map(async (symbol): Promise<[string, KrwTickerDailyData | null]> => {
        try {
          const data = await this.getTickerAndDailyData(symbol);
          return [symbol, data];
        } catch {
          return [symbol, null];
        }
      }),
    );

    return new Map(entries.filter((entry): entry is [string, KrwTickerDailyData] => entry[1] != null));
  }

  /**
   * 특정 종목의 최근 1분봉 캔들을 가져옵니다.
   * 변동성 계산용으로 기본 6개를 조회합니다.
   */
  public async getRecentMinuteCandles(symbol: string, limit = 6): Promise<any[]> {
    const client = await this.getServerClient();

    try {
      const candles = await this.errorService.retryWithFallback(async () => {
        return await client.fetchOHLCV(symbol, '1m', undefined, limit);
      }, this.retryOptions);

      return candles;
    } catch (error) {
      this.logger.error(this.i18n.t('logging.upbit.market.load_failed', { args: { symbol } }), error);
      throw error;
    }
  }

  /**
   * 특정 시각이 포함된 1분봉의 시가(open)를 반환합니다.
   * 추천 시점 가격 등 "해당 시각 기준 가격" 계산용. 호출당 1건 조회로 비용 최소.
   * @param symbol 종목
   * @param time 기준 시각
   * @returns 해당 분봉 시가, 없거나 실패 시 undefined
   */
  public async getMinuteCandleAt(symbol: string, time: Date): Promise<number | undefined> {
    const client = await this.getServerClient();
    const minuteStartMs = Math.floor(new Date(time).getTime() / 60_000) * 60_000;
    const cacheKey = `upbit:minute-open:${symbol}:${minuteStartMs}`;
    const cached = await this.cacheService.get<{ value: number | null }>(cacheKey);
    if (cached !== null) {
      return cached.value ?? undefined;
    }

    try {
      const candles = await this.errorService.retryWithFallback(async () => {
        return await client.fetchOHLCV(symbol, '1m', minuteStartMs, 1);
      }, this.retryOptions);

      const candle = candles?.[0];
      if (!candle || candle.length < 5) {
        await this.cacheService.set(cacheKey, { value: null }, this.MINUTE_OPEN_NULL_CACHE_TTL_SECONDS);
        return undefined;
      }
      const open = Number(candle[1]);
      const value = Number.isFinite(open) && open > 0 ? open : null;
      const ttl = value == null ? this.MINUTE_OPEN_NULL_CACHE_TTL_SECONDS : this.MINUTE_OPEN_VALUE_CACHE_TTL_SECONDS;
      await this.cacheService.set(cacheKey, { value }, ttl);
      return value ?? undefined;
    } catch {
      await this.cacheService.set(cacheKey, { value: null }, this.MINUTE_OPEN_NULL_CACHE_TTL_SECONDS);
      return undefined;
    }
  }
}
