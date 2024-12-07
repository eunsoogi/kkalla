import { Injectable, Logger } from '@nestjs/common';

import { Balances } from 'ccxt';
import { I18nService } from 'nestjs-i18n';

import { ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { AccumulationService } from '../accumulation/accumulation.service';
import { GetAccumulationDto } from '../accumulation/dto/get-accumulation.dto';
import { Inference } from '../inference/entities/inference.entity';
import { InferenceCategory } from '../inference/inference.enum';
import { InferenceItem } from '../inference/inference.interface';
import { InferenceService } from '../inference/inference.service';
import { SortDirection } from '../item/item.enum';
import { NotifyService } from '../notify/notify.service';
import { Permission } from '../permission/permission.enum';
import { SequenceService } from '../sequence/sequence.service';
import { OrderTypes } from '../upbit/upbit.enum';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../user/entities/user.entity';
import { TradeHistory } from './entities/trade-history.entity';
import { Trade } from './entities/trade.entity';
import { TradeData, TradeRequest } from './trade.interface';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  private readonly COIN_MAJOR = ['BTC/KRW', 'ETH/KRW'] as const;
  private readonly COIN_MINOR_REQUEST: GetAccumulationDto = {
    market: 'KRW',
    open: true,
    distinct: true,
    display: 20,
    order: 'strength',
    sortDirection: SortDirection.DESC,
    priceRateUpper: 0.02,
  };
  private readonly MINIMUM_TRADE_RATE = 0.5;
  private readonly TOP_INFERENCE_COUNT = 10;

  constructor(
    private readonly i18n: I18nService,
    private readonly sequenceService: SequenceService,
    private readonly inferenceService: InferenceService,
    private readonly accumulationService: AccumulationService,
    private readonly upbitService: UpbitService,
    private readonly notifyService: NotifyService,
  ) {}

  public async getInferenceItems(): Promise<InferenceItem[]> {
    const items = [
      ...(await this.getInferenceItemByCoinMajor()),
      ...(await this.getInferenceItemByCoinMinor()),
      ...(await this.getInferenceItemByNasdaq()),
      ...(await this.getInferenceItemFromTradeHistory()),
    ];

    const filteredItems = items.filter(
      (item, index, self) => index === self.findIndex((t) => t.ticker === item.ticker),
    );

    return filteredItems;
  }

  private async getInferenceItemByCoinMajor(): Promise<InferenceItem[]> {
    return this.COIN_MAJOR.map((ticker) => ({
      ticker,
      category: InferenceCategory.COIN_MAJOR,
    }));
  }

  private async getInferenceItemByCoinMinor(): Promise<InferenceItem[]> {
    const items = await this.accumulationService.getAllAccumulations(this.COIN_MINOR_REQUEST);

    return items.map((item) => ({
      ticker: `${item.symbol}/${item.market}`,
      category: InferenceCategory.COIN_MINOR,
    }));
  }

  // TO-DO: NASDAQ 종목 추론
  private async getInferenceItemByNasdaq(): Promise<InferenceItem[]> {
    return [];
  }

  private async getInferenceItemFromTradeHistory(): Promise<InferenceItem[]> {
    const items = await TradeHistory.find();

    return items.map((item) => ({
      ticker: item.ticker,
      category: item.category,
    }));
  }

  private async performInferences(): Promise<Inference[]> {
    const items = await this.getInferenceItems();
    const inferences = await Promise.all(items.map((item) => this.inferenceService.getInference(item)));

    return inferences.filter((item) => item !== null);
  }

  public getAuthorizedInferences(user: User, inferences: Inference[]): Inference[] {
    return inferences.filter((inference) => this.validateCategoryPermission(user, inference.category));
  }

  public calculateDiff(balances: Balances, ticker: string, rate: number, category: InferenceCategory): number {
    switch (category) {
      case InferenceCategory.COIN_MAJOR:
      case InferenceCategory.COIN_MINOR:
        return this.upbitService.calculateDiff(balances, ticker, rate);
    }

    return 0;
  }

  public getNonInferenceTradeRequests(balances: Balances, inferences: Inference[]): TradeRequest[] {
    const tradeRequests: TradeRequest[] = balances.info
      .filter((item) => {
        const ticker = `${item.currency}/${item.unit_currency}`;
        return item.currency !== item.unit_currency && !inferences.some((inference) => inference.ticker === ticker);
      })
      .map((item) => ({
        ticker: `${item.currency}/${item.unit_currency}`,
        diff: -1,
        balances,
      }));

    return tradeRequests;
  }

  private getIncludedInferences(inferences: Inference[]): Inference[] {
    const filteredInferences = inferences
      .filter((item) => item.rate >= this.MINIMUM_TRADE_RATE) // 매매 비율 제한
      .sort((a, b) => b.rate - a.rate) // 내림차순으로 정렬
      .slice(0, this.TOP_INFERENCE_COUNT); // 포트폴리오 개수 제한

    return filteredInferences;
  }

  private getIncludedTradeRequests(balances: Balances, inferences: Inference[]): TradeRequest[] {
    const filteredInferences = this.getIncludedInferences(inferences);
    const count = filteredInferences.length;

    const tradeRequests: TradeRequest[] = filteredInferences
      .map((inference) => ({
        ticker: inference.ticker,
        diff: this.calculateDiff(balances, inference.ticker, inference.rate / count, inference.category),
        balances,
        inference,
      }))
      .sort((a, b) => a.diff - b.diff); // 오름차순으로 정렬

    return tradeRequests;
  }

  private getExcludedInferences(inferences: Inference[]): Inference[] {
    const filteredInferences = inferences
      .sort((a, b) => b.rate - a.rate) // 내림차순으로 정렬
      .filter((item, index) => item.rate < this.MINIMUM_TRADE_RATE || index >= this.TOP_INFERENCE_COUNT) // 매매 비율 또는 포트폴리오 개수 제한
      .sort((a, b) => a.rate - b.rate); // 오름차순으로 정렬

    return filteredInferences;
  }

  private getExcludedTradeRequests(balances: Balances, inferences: Inference[]): TradeRequest[] {
    const filteredInferences = this.getExcludedInferences(inferences);

    const tradeRequests: TradeRequest[] = filteredInferences.map((inference) => ({
      ticker: inference.ticker,
      diff: -1,
      balances,
      inference,
    }));

    return tradeRequests;
  }

  public async adjustPortfolios(users: User[]): Promise<Trade[]> {
    const inferences = await this.performInferences();
    const trades = await Promise.all(users.map((user) => this.adjustPortfolio(user, inferences)));
    const includedInferences = this.getIncludedInferences(inferences);

    await this.createTradeHistory(includedInferences);

    return trades.flat();
  }

  public async adjustPortfolio(user: User, inferences: Inference[]): Promise<Trade[]> {
    // 권한이 있는 추론만 필터링
    const authorizedInferences = this.getAuthorizedInferences(user, inferences);

    authorizedInferences.map((inference) => {
      this.notifyService.notify(
        user,
        this.i18n.t('notify.inference.result', {
          args: {
            ...inference,
            rate: inference.rate * 100,
          },
        }),
      );
    });

    // 유저 계좌 조회
    const balances = await this.upbitService.getBalances(user);

    if (!balances) return [];

    // 편입/편출 결정 분리
    const nonInferenceTradeRequests: TradeRequest[] = this.getNonInferenceTradeRequests(balances, authorizedInferences);
    const excludedTradeRequests: TradeRequest[] = this.getExcludedTradeRequests(balances, authorizedInferences);
    const includedTradeRequests: TradeRequest[] = this.getIncludedTradeRequests(balances, authorizedInferences);

    // 편출 처리
    const nonInferenceTrades: Trade[] = await Promise.all(
      nonInferenceTradeRequests.map((request) => this.trade(user, request)),
    );

    const excludedTrades: Trade[] = await Promise.all(
      excludedTradeRequests.map((request) => this.trade(user, request)),
    );

    // 편입 처리
    const includedTrades: Trade[] = await Promise.all(
      includedTradeRequests.map((request) => this.trade(user, request)),
    );

    return [...nonInferenceTrades, ...excludedTrades, ...includedTrades].filter((item) => item !== null);
  }

  private validateCategoryPermission(user: User, category: InferenceCategory): boolean {
    const userPermissions = user.roles.flatMap((role) => role.permissions || []);
    const requiredPermission = this.getCategoryPermission(category);
    return userPermissions.includes(requiredPermission);
  }

  private getCategoryPermission(category: InferenceCategory): Permission {
    switch (category) {
      case InferenceCategory.NASDAQ:
        return Permission.TRADE_NASDAQ;

      case InferenceCategory.COIN_MAJOR:
        return Permission.TRADE_COIN_MAJOR;

      case InferenceCategory.COIN_MINOR:
        return Permission.TRADE_COIN_MINOR;

      default:
        throw new Error(
          this.i18n.t('logging.inference.unknown_category', {
            args: { category },
          }),
        );
    }
  }

  public async trade(user: User, request: TradeRequest): Promise<Trade> {
    const order = await this.upbitService.adjustOrder(user, request);

    if (!order) return null;

    const trade = await this.createTrade(user, {
      ticker: request.ticker,
      type: order.side as OrderTypes,
      amount: order?.amount ?? order?.cost,
      balances: request.balances,
      inference: request.inference,
    });

    this.notifyService.notify(
      user,
      this.i18n.t('notify.order.result', {
        args: {
          ...trade,
          type: this.i18n.t(`label.order.type.${trade.type}`),
          amount: trade.amount.toLocaleString(),
        },
      }),
    );

    return trade;
  }

  public async createTrade(user: User, data: TradeData): Promise<Trade> {
    const trade = new Trade();

    Object.assign(trade, data);
    trade.seq = await this.sequenceService.getNextSequence();
    trade.user = user;

    return trade.save();
  }

  public async createTradeHistory(inferences: Inference[]): Promise<TradeHistory[]> {
    TradeHistory.delete({});

    const tradeHistories = inferences.map((inference) => {
      const tradeHistory = new TradeHistory();
      tradeHistory.ticker = inference.ticker;
      tradeHistory.category = inference.category;
      return tradeHistory;
    });

    return TradeHistory.save(tradeHistories);
  }

  public async paginate(user: User, request: ItemRequest): Promise<PaginatedItem<Trade>> {
    return Trade.paginate(user, request);
  }
}
