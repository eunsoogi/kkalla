import { Injectable, Logger } from '@nestjs/common';

import { AuthenticationError, Balances, Order, upbit } from 'ccxt';
import { I18nService } from 'nestjs-i18n';

import { ApikeyStatus } from '../apikey/apikey.enum';
import { CacheService } from '../cache/cache.service';
import { ErrorService } from '../error/error.service';
import { TwoPhaseRetryOptions } from '../error/error.types';
import { NotifyService } from '../notify/notify.service';
import { Schedule } from '../schedule/entities/schedule.entity';
import { TradeCostCalibrationService } from '../trade/trade-cost-calibration.service';
import { User } from '../user/entities/user.entity';
import { UpbitConfig } from './entities/upbit-config.entity';
import { UPBIT_MINIMUM_TRADE_PRICE } from './upbit.constant';
import { OrderTypes } from './upbit.enum';
import {
  AdjustOrderRequest,
  AdjustedOrderResult,
  BuyCostCalibrationLookupResult,
  KrwMarketData,
  KrwTickerDailyData,
  OrderExecutionUrgency,
  OrderRequest,
  UpbitConfigData,
  UpbitOrderCostEstimate,
} from './upbit.types';

@Injectable()
export class UpbitService {
  private readonly logger = new Logger(UpbitService.name);
  private serverClient: upbit;
  private client: upbit[] = [];
  private readonly MAX_PRECISION = 8;
  private readonly MINUTE_OPEN_VALUE_CACHE_TTL_SECONDS = 60 * 60 * 24;
  private readonly MINUTE_OPEN_NULL_CACHE_TTL_SECONDS = 60;
  private readonly ORDERBOOK_CACHE_TTL_SECONDS = 5;
  private readonly ESTIMATED_FEE_RATE = 0.0005;
  private readonly EDGE_COST_BUFFER_RATE = 0.0005;

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
    private readonly tradeCostCalibrationService: TradeCostCalibrationService,
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
          this.logger.error(this.i18n.t('logging.upbit.apikey.serverExpired'));
          await this.notifyService.notifyServer(this.i18n.t('notify.upbit.apikey.serverExpired'));
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
          this.logger.warn(this.i18n.t('logging.upbit.apikey.userExpired', { args: { id: user.id } }));

          // 스케줄 비활성화
          const schedule = await Schedule.findByUser(user);

          if (schedule) {
            schedule.enabled = false;
            await schedule.save();
            this.logger.log(this.i18n.t('logging.upbit.apikey.scheduleDisabled', { args: { id: user.id } }));
          }

          await this.notifyService.notify(user, this.i18n.t('notify.upbit.apikey.userExpired'));
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

  public calculateRequestDiff(balances: Balances, symbol: string, targetWeight: number): number {
    const symbolPrice = this.calculatePrice(balances, symbol);
    const marketPrice = this.calculateTotalPrice(balances);
    const currentWeight = symbolPrice / marketPrice;
    const requestDiff = (targetWeight - currentWeight) / (currentWeight || 1);

    return requestDiff;
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

  private isFinalizedOrderStatus(status: unknown): boolean {
    if (typeof status !== 'string') {
      return false;
    }

    const normalized = status.toLowerCase();
    return normalized === 'closed' || normalized === 'filled' || normalized === 'done';
  }

  public async calculateAmount(order: Order): Promise<number> {
    const cost = Number(order?.cost);
    if (Number.isFinite(cost) && cost > 0) {
      return cost;
    }

    const filled = Number(order?.filled);
    const average = Number(order?.average);
    if (Number.isFinite(filled) && filled > 0) {
      if (Number.isFinite(average) && average > 0) {
        return filled * average;
      }

      const client = await this.getServerClient();

      const ticker = await this.errorService.retryWithFallback(async () => {
        return await client.fetchTicker(order.symbol);
      }, this.retryOptions);

      return filled * ticker.last;
    }

    const amount = Number(order?.amount);
    if (Number.isFinite(amount) && amount > 0 && this.isFinalizedOrderStatus(order?.status)) {
      const client = await this.getServerClient();

      const ticker = await this.errorService.retryWithFallback(async () => {
        return await client.fetchTicker(order.symbol);
      }, this.retryOptions);

      return amount * ticker.last;
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

  private getDefaultCostEstimate(): UpbitOrderCostEstimate {
    return {
      feeRate: this.ESTIMATED_FEE_RATE,
      spreadRate: 0,
      impactRate: 0,
      estimatedCostRate: this.ESTIMATED_FEE_RATE,
    };
  }

  private normalizePositiveNumber(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return parsed;
  }

  private normalizeOrderBookLevels(levels: unknown): Array<[number, number]> {
    if (!Array.isArray(levels)) {
      return [];
    }

    return levels
      .map((entry) => {
        if (!Array.isArray(entry) || entry.length < 2) {
          return null;
        }

        const price = this.normalizePositiveNumber(entry[0]);
        const amount = this.normalizePositiveNumber(entry[1]);
        if (price == null || amount == null) {
          return null;
        }

        return [price, amount] as [number, number];
      })
      .filter((entry): entry is [number, number] => entry !== null);
  }

  private async getOrderBook(
    symbol: string,
  ): Promise<{ bids: Array<[number, number]>; asks: Array<[number, number]> }> {
    const cacheKey = `upbit:orderbook:${symbol}`;
    const cached = await this.cacheService.get<{ bids: Array<[number, number]>; asks: Array<[number, number]> }>(
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    const client = await this.getServerClient();
    const orderBook = await this.errorService.retryWithFallback(async () => {
      return await client.fetchOrderBook(symbol);
    }, this.retryOptions);

    const normalizedOrderBook = {
      bids: this.normalizeOrderBookLevels(orderBook?.bids),
      asks: this.normalizeOrderBookLevels(orderBook?.asks),
    };
    await this.cacheService.set(cacheKey, normalizedOrderBook, this.ORDERBOOK_CACHE_TTL_SECONDS);

    return normalizedOrderBook;
  }

  private resolveReferencePrice(
    bestBid: number | null,
    bestAsk: number | null,
    tickerPrice: number | null,
    fallbackPrice: number,
  ): number {
    if (bestBid != null && bestAsk != null) {
      return (bestBid + bestAsk) / 2;
    }

    if (bestAsk != null) {
      return bestAsk;
    }

    if (bestBid != null) {
      return bestBid;
    }

    if (tickerPrice != null) {
      return tickerPrice;
    }

    return fallbackPrice;
  }

  private calculateBuyImpactRate(
    levels: Array<[number, number]>,
    targetNotional: number,
    referencePrice: number,
  ): number {
    if (
      !Number.isFinite(targetNotional) ||
      targetNotional <= 0 ||
      !Number.isFinite(referencePrice) ||
      referencePrice <= 0
    ) {
      return 0;
    }

    let remainingNotional = targetNotional;
    let consumedNotional = 0;
    let consumedVolume = 0;

    for (const [price, amount] of levels) {
      if (remainingNotional <= 0) {
        break;
      }

      const levelNotional = price * amount;
      if (!Number.isFinite(levelNotional) || levelNotional <= 0) {
        continue;
      }

      const takenNotional = Math.min(levelNotional, remainingNotional);
      consumedNotional += takenNotional;
      consumedVolume += takenNotional / price;
      remainingNotional -= takenNotional;
    }

    if (consumedVolume <= 0) {
      return 0;
    }

    const averageExecutionPrice = consumedNotional / consumedVolume;
    const baseImpact = Math.max(0, (averageExecutionPrice - referencePrice) / referencePrice);
    const depthPenalty = remainingNotional > 0 ? Math.min(0.05, (remainingNotional / targetNotional) * 0.02) : 0;

    return baseImpact + depthPenalty;
  }

  private calculateSellImpactRate(
    levels: Array<[number, number]>,
    targetVolume: number,
    referencePrice: number,
  ): number {
    if (
      !Number.isFinite(targetVolume) ||
      targetVolume <= 0 ||
      !Number.isFinite(referencePrice) ||
      referencePrice <= 0
    ) {
      return 0;
    }

    let remainingVolume = targetVolume;
    let consumedNotional = 0;
    let consumedVolume = 0;

    for (const [price, amount] of levels) {
      if (remainingVolume <= 0) {
        break;
      }

      const takenVolume = Math.min(amount, remainingVolume);
      consumedNotional += takenVolume * price;
      consumedVolume += takenVolume;
      remainingVolume -= takenVolume;
    }

    if (consumedVolume <= 0) {
      return 0;
    }

    const averageExecutionPrice = consumedNotional / consumedVolume;
    const baseImpact = Math.max(0, (referencePrice - averageExecutionPrice) / referencePrice);
    const depthPenalty = remainingVolume > 0 ? Math.min(0.05, (remainingVolume / targetVolume) * 0.02) : 0;

    return baseImpact + depthPenalty;
  }

  public async estimateOrderCost(
    symbol: string,
    type: OrderTypes,
    requestedAmount: number,
    fallbackPrice?: number,
  ): Promise<UpbitOrderCostEstimate> {
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return this.getDefaultCostEstimate();
    }

    try {
      const [orderBook, tickerPrice] = await Promise.all([
        this.getOrderBook(symbol),
        this.getPrice(symbol).catch(() => null),
      ]);
      const bestBid = this.normalizePositiveNumber(orderBook.bids[0]?.[0] ?? null);
      const bestAsk = this.normalizePositiveNumber(orderBook.asks[0]?.[0] ?? null);
      const referencePrice = this.resolveReferencePrice(bestBid, bestAsk, tickerPrice, fallbackPrice ?? 0);

      const spreadRate =
        bestBid != null && bestAsk != null && referencePrice > 0
          ? Math.max(0, (bestAsk - bestBid) / referencePrice)
          : 0;
      const impactRate =
        type === OrderTypes.BUY
          ? this.calculateBuyImpactRate(orderBook.asks, requestedAmount, referencePrice)
          : this.calculateSellImpactRate(orderBook.bids, requestedAmount, referencePrice);
      const estimatedCostRate = this.ESTIMATED_FEE_RATE + spreadRate + impactRate;

      return {
        feeRate: this.ESTIMATED_FEE_RATE,
        spreadRate: Number.isFinite(spreadRate) ? spreadRate : 0,
        impactRate: Number.isFinite(impactRate) ? impactRate : 0,
        estimatedCostRate: Number.isFinite(estimatedCostRate) ? estimatedCostRate : this.ESTIMATED_FEE_RATE,
      };
    } catch {
      return this.getDefaultCostEstimate();
    }
  }

  private shouldSkipForEdgeCost(
    urgency: OrderExecutionUrgency,
    expectedEdgeRate: number | null | undefined,
    estimatedCostRate: number,
  ): boolean {
    if (urgency === 'urgent') {
      return false;
    }

    if (expectedEdgeRate == null || !Number.isFinite(expectedEdgeRate)) {
      return false;
    }

    return expectedEdgeRate <= estimatedCostRate + this.EDGE_COST_BUFFER_RATE;
  }

  private logBuyCostCalibrationDecision(args: {
    calibration: BuyCostCalibrationLookupResult;
    expectedEdgeRate: number | null | undefined;
    staticDecision: 'allow' | 'skip';
    calibratedDecision: 'allow' | 'skip';
  }): void {
    this.logger.log(
      this.i18n.t('logging.upbit.costCalibration.gate', {
        args: {
          calibrationApplied: args.calibration.calibrationApplied,
          calibrationReason: args.calibration.calibrationReason,
          bucketKey: args.calibration.bucketKey ?? '',
          staticNonFeeCostRate: args.calibration.staticNonFeeCostRate ?? '',
          rawMultiplier: args.calibration.rawMultiplier ?? '',
          appliedMultiplier: args.calibration.appliedMultiplier,
          calibratedEstimatedCostRate: args.calibration.calibratedEstimatedCostRate ?? '',
          expectedEdgeRate: args.expectedEdgeRate ?? '',
          staticDecision: args.staticDecision,
          calibratedDecision: args.calibratedDecision,
        },
      }),
    );
  }

  private resolveOrderNotional(order: Order | null, fallbackPrice: number): number {
    if (!order) {
      return 0;
    }

    const cost = this.normalizePositiveNumber(order.cost);
    if (cost != null) {
      return cost;
    }

    const average = this.normalizePositiveNumber(order.average);
    const filled = this.normalizePositiveNumber(order.filled);
    if (average != null && filled != null) {
      return average * filled;
    }

    if (filled != null && Number.isFinite(fallbackPrice) && fallbackPrice > 0) {
      return filled * fallbackPrice;
    }

    const status = typeof order.status === 'string' ? order.status.toLowerCase() : null;
    const isFinalizedOrder = status === 'closed' || status === 'filled';

    const amount = this.normalizePositiveNumber(order.amount);
    if (isFinalizedOrder && amount != null && average != null) {
      return amount * average;
    }

    if (isFinalizedOrder && amount != null && Number.isFinite(fallbackPrice) && fallbackPrice > 0) {
      return amount * fallbackPrice;
    }

    return 0;
  }

  private resolveOrderAveragePrice(order: Order | null, fallbackPrice: number): number | null {
    if (!order) {
      return null;
    }

    const average = this.normalizePositiveNumber(order.average);
    if (average != null) {
      return average;
    }

    const cost = this.normalizePositiveNumber(order.cost);
    const filled = this.normalizePositiveNumber(order.filled);
    if (cost != null && filled != null) {
      return cost / filled;
    }

    if (Number.isFinite(fallbackPrice) && fallbackPrice > 0) {
      return fallbackPrice;
    }

    return null;
  }

  private createAdjustedOrderResult(
    request: AdjustOrderRequest,
    options?: {
      order?: Order | null;
      requestPrice?: number | null;
      requestedAmount?: number | null;
      requestedVolume?: number | null;
      filledAmount?: number | null;
      filledVolume?: number | null;
      averagePrice?: number | null;
      estimatedCostRate?: number | null;
      spreadRate?: number | null;
      impactRate?: number | null;
      gateBypassedReason?: string | null;
      triggerReason?: string | null;
    },
  ): AdjustedOrderResult {
    return {
      order: options?.order ?? null,
      requestPrice: options?.requestPrice ?? null,
      requestedAmount: options?.requestedAmount ?? null,
      requestedVolume: options?.requestedVolume ?? null,
      filledAmount: options?.filledAmount ?? null,
      filledVolume: options?.filledVolume ?? null,
      averagePrice: options?.averagePrice ?? null,
      expectedEdgeRate: request.expectedEdgeRate ?? null,
      estimatedCostRate: options?.estimatedCostRate ?? request.costEstimate?.estimatedCostRate ?? null,
      spreadRate: options?.spreadRate ?? request.costEstimate?.spreadRate ?? null,
      impactRate: options?.impactRate ?? request.costEstimate?.impactRate ?? null,
      gateBypassedReason: options?.gateBypassedReason ?? request.gateBypassedReason ?? null,
      triggerReason: options?.triggerReason ?? request.triggerReason ?? null,
    };
  }

  private extractExchangeErrorCodeFromMessage(message: unknown): string | null {
    if (typeof message !== 'string' || message.trim().length < 1) {
      return null;
    }

    const jsonStart = message.indexOf('{');
    if (jsonStart < 0) {
      return null;
    }

    const payload = message.slice(jsonStart);

    try {
      const parsed = JSON.parse(payload) as {
        error?: {
          name?: unknown;
        };
      };
      return typeof parsed.error?.name === 'string' ? parsed.error.name.toLowerCase() : null;
    } catch {
      return null;
    }
  }

  private extractExchangeErrorCode(error: unknown): string | null {
    if (error && typeof error === 'object') {
      const maybeError = error as {
        name?: unknown;
        error?: {
          name?: unknown;
        };
        message?: unknown;
      };

      if (typeof maybeError.error?.name === 'string' && maybeError.error.name.length > 0) {
        return maybeError.error.name.toLowerCase();
      }

      if (typeof maybeError.name === 'string') {
        const name = maybeError.name.toLowerCase();
        if (name === 'out_of_scope' || name === 'done_order') {
          return name;
        }
      }

      const fromObjectMessage = this.extractExchangeErrorCodeFromMessage(maybeError.message);
      if (fromObjectMessage) {
        return fromObjectMessage;
      }
    }

    if (error instanceof Error) {
      return this.extractExchangeErrorCodeFromMessage(error.message);
    }

    return null;
  }

  private isTerminalTradeError(error: unknown): boolean {
    const code = this.extractExchangeErrorCode(error);
    return code === 'out_of_scope' || code === 'done_order';
  }

  public async order(user: User, request: OrderRequest): Promise<Order | null> {
    const deductionAmount = 1 / 10 ** this.MAX_PRECISION;

    try {
      const client = await this.getClient(user);
      let retries = 0;

      return await this.errorService.retry(
        async () => {
          const amount = Math.max(request.amount - deductionAmount * retries++, deductionAmount);

          switch (request.type) {
            case OrderTypes.BUY:
              return await client.createOrder(request.symbol, 'market', request.type, 1, amount);

            case OrderTypes.SELL:
              return await client.createOrder(request.symbol, 'market', request.type, amount);

            default:
              return null;
          }
        },
        {
          maxRetries: 10,
          retryDelay: 1000,
          isNonRetryable: (error: unknown) => this.isTerminalTradeError(error),
        },
      );
    } catch (error) {
      this.logger.error(this.i18n.t('logging.order.fail', { args: { id: user.id } }), error);
      await this.notifyService.notify(user, this.i18n.t('notify.order.fail', { args: request }));
    }

    return null;
  }

  /**
   * Attempts to cancel exchange orders by id.
   * @param user - User whose exchange client will be used.
   * @param orderId - Order identifier (comma-separated ids are supported).
   * @param symbol - Optional market symbol for exchange adapters requiring it.
   */
  public async cancelOrder(user: User, orderId: string, symbol?: string): Promise<void> {
    const orderIds = orderId
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (orderIds.length < 1) {
      return;
    }

    const client = await this.getClient(user);

    await Promise.all(
      orderIds.map((targetOrderId) =>
        this.errorService.retryWithFallback(
          async () => {
            await client.cancelOrder(targetOrderId, symbol);
          },
          {
            ...this.retryOptions,
            isNonRetryable: (error: unknown) => this.isTerminalTradeError(error),
          },
        ),
      ),
    );
  }

  public async fetchOrder(user: User, orderId: string, symbol: string): Promise<Order | null> {
    try {
      const client = await this.getClient(user);
      if (typeof (client as any).fetchOrder !== 'function') {
        return null;
      }

      const order = await this.errorService.retryWithFallback(
        async () => {
          return await (client as any).fetchOrder(orderId, symbol);
        },
        {
          ...this.retryOptions,
          isNonRetryable: (error: unknown) => this.isTerminalTradeError(error),
        },
      );

      return (order as Order) ?? null;
    } catch {
      return null;
    }
  }

  public async adjustOrder(user: User, request: AdjustOrderRequest): Promise<AdjustedOrderResult> {
    this.logger.log(this.i18n.t('logging.order.start', { args: { id: user.id } }));

    const { symbol, requestDiff, executionDiff, balances, marketPrice: precomputedMarketPrice } = request;
    const [baseAsset] = symbol.split('/');
    const effectiveExecutionDiff =
      executionDiff != null && Number.isFinite(executionDiff) ? executionDiff : requestDiff;
    const urgency: OrderExecutionUrgency =
      request.executionUrgency ?? (effectiveExecutionDiff < 0 ? 'urgent' : 'normal');
    const symbolExist = await this.isSymbolExist(symbol);

    if (!symbolExist) {
      return this.createAdjustedOrderResult(request, {
        triggerReason: request.triggerReason ?? 'symbol_not_orderable',
      });
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
      const tradePrice = (symbolMarketPrice || marketPrice) * Math.abs(effectiveExecutionDiff) * 0.9995;
      const tradeVolume = symbolTradableVolume * Math.abs(effectiveExecutionDiff);

      let type: OrderTypes | null = null;
      let requestedAmount: number | null = null;
      let requestedVolume: number | null = null;

      if (effectiveExecutionDiff > 0 && tradePrice > UPBIT_MINIMUM_TRADE_PRICE) {
        type = OrderTypes.BUY;
        requestedAmount = tradePrice;
        requestedVolume = currPrice > 0 ? tradePrice / currPrice : null;
      } else if (effectiveExecutionDiff < 0 && tradeVolume * currPrice > UPBIT_MINIMUM_TRADE_PRICE) {
        type = OrderTypes.SELL;
        requestedAmount = tradeVolume * currPrice;
        requestedVolume = tradeVolume;
      } else {
        return this.createAdjustedOrderResult(request, {
          triggerReason: request.triggerReason ?? 'below_min_trade_amount',
          requestedAmount: requestedAmount ?? null,
          requestedVolume: requestedVolume ?? null,
        });
      }

      const dynamicCostEstimate =
        request.costEstimate ??
        (type === OrderTypes.BUY
          ? await this.estimateOrderCost(symbol, type, requestedAmount, currPrice)
          : await this.estimateOrderCost(symbol, type, requestedVolume ?? 0, currPrice));
      const liveCalibrationContext =
        request.costCalibrationContext && type === OrderTypes.BUY
          ? {
              ...request.costCalibrationContext,
              costTier: this.tradeCostCalibrationService.resolveCostTier(
                Math.max(0, dynamicCostEstimate.spreadRate) + Math.max(0, dynamicCostEstimate.impactRate),
              ),
            }
          : request.costCalibrationContext;
      const calibration = await this.tradeCostCalibrationService.resolveBuyGateCalibration({
        type,
        urgency,
        estimatedCostRate: dynamicCostEstimate.estimatedCostRate,
        spreadRate: dynamicCostEstimate.spreadRate,
        impactRate: dynamicCostEstimate.impactRate,
        calibrationContext: liveCalibrationContext,
      });
      const effectiveEstimatedCostRate =
        calibration.calibrationApplied && calibration.calibratedEstimatedCostRate != null
          ? calibration.calibratedEstimatedCostRate
          : dynamicCostEstimate.estimatedCostRate;
      const staticDecision = this.shouldSkipForEdgeCost(
        urgency,
        request.expectedEdgeRate,
        dynamicCostEstimate.estimatedCostRate,
      )
        ? 'skip'
        : 'allow';
      const calibratedDecision = this.shouldSkipForEdgeCost(
        urgency,
        request.expectedEdgeRate,
        effectiveEstimatedCostRate,
      )
        ? 'skip'
        : 'allow';
      this.logBuyCostCalibrationDecision({
        calibration,
        expectedEdgeRate: request.expectedEdgeRate,
        staticDecision,
        calibratedDecision,
      });
      const gateBypassedReason =
        urgency === 'urgent' &&
        request.expectedEdgeRate != null &&
        Number.isFinite(request.expectedEdgeRate) &&
        request.expectedEdgeRate <= effectiveEstimatedCostRate + this.EDGE_COST_BUFFER_RATE
          ? 'urgent_risk_reduction'
          : (request.gateBypassedReason ?? null);

      if (this.shouldSkipForEdgeCost(urgency, request.expectedEdgeRate, effectiveEstimatedCostRate)) {
        return this.createAdjustedOrderResult(request, {
          requestPrice: currPrice,
          requestedAmount,
          requestedVolume,
          estimatedCostRate: effectiveEstimatedCostRate,
          spreadRate: dynamicCostEstimate.spreadRate,
          impactRate: dynamicCostEstimate.impactRate,
          triggerReason: request.triggerReason ?? 'edge_below_cost',
        });
      }

      const primaryOrderAmount = type === OrderTypes.BUY ? (requestedAmount ?? 0) : (requestedVolume ?? 0);
      if (primaryOrderAmount <= 0) {
        return this.createAdjustedOrderResult(request, {
          requestPrice: currPrice,
          requestedAmount,
          requestedVolume,
          estimatedCostRate: effectiveEstimatedCostRate,
          spreadRate: dynamicCostEstimate.spreadRate,
          impactRate: dynamicCostEstimate.impactRate,
          triggerReason: request.triggerReason ?? 'invalid_order_amount',
        });
      }

      const primaryOrder = await this.order(user, {
        symbol,
        type,
        amount: primaryOrderAmount,
        costEstimate: dynamicCostEstimate,
        expectedEdgeRate: request.expectedEdgeRate,
        gateBypassedReason,
        triggerReason: request.triggerReason,
      });

      const finalOrder = primaryOrder;
      const rawFilledAmount = this.resolveOrderNotional(finalOrder, currPrice);
      const averagePrice = this.resolveOrderAveragePrice(finalOrder, currPrice);
      const isFinalizedOrder = this.isFinalizedOrderStatus(finalOrder?.status);
      const filledAmount =
        finalOrder == null
          ? null
          : Number.isFinite(rawFilledAmount) && rawFilledAmount > Number.EPSILON
            ? rawFilledAmount
            : isFinalizedOrder && requestedAmount != null && requestedAmount > Number.EPSILON
              ? requestedAmount
              : null;
      const rawFilledVolume = this.normalizePositiveNumber(finalOrder?.filled);
      const filledVolume =
        finalOrder == null
          ? null
          : rawFilledVolume != null
            ? rawFilledVolume
            : averagePrice != null &&
                averagePrice > Number.EPSILON &&
                filledAmount != null &&
                Number.isFinite(filledAmount) &&
                filledAmount > Number.EPSILON
              ? filledAmount / averagePrice
              : isFinalizedOrder && requestedVolume != null && requestedVolume > Number.EPSILON
                ? requestedVolume
                : null;

      return this.createAdjustedOrderResult(request, {
        order: finalOrder,
        requestPrice: currPrice,
        requestedAmount,
        requestedVolume,
        filledAmount,
        filledVolume,
        averagePrice,
        estimatedCostRate: effectiveEstimatedCostRate,
        spreadRate: dynamicCostEstimate.spreadRate,
        impactRate: dynamicCostEstimate.impactRate,
        gateBypassedReason,
      });
    } catch (error) {
      this.logger.error(this.i18n.t('logging.order.fail', { args: { id: user.id } }), error);
      await this.notifyService.notify(user, this.i18n.t('notify.order.fail', { args: request }));
    }

    return this.createAdjustedOrderResult(request);
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
      this.logger.error(this.i18n.t('logging.upbit.markets.loadFailed'), error);
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
      this.logger.error(this.i18n.t('logging.upbit.market.loadFailed', { args: { symbol } }), error);
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
      this.logger.error(this.i18n.t('logging.upbit.market.loadFailed', { args: { symbol } }), error);
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
