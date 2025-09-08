import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';
import { Balances } from 'ccxt';
import { I18nService } from 'nestjs-i18n';

import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '@/modules/item/item.interface';
import { formatNumber } from '@/utils/number';

import { Category } from '../category/category.enum';
import { CategoryService } from '../category/category.service';
import { HistoryService } from '../history/history.service';
import { BalanceRecommendationData, RecommendationItem } from '../inference/inference.interface';
import { InferenceService } from '../inference/inference.service';
import { NotifyService } from '../notify/notify.service';
import { ProfitService } from '../profit/profit.service';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../user/entities/user.entity';
import { PostTradeDto } from './dto/post-trade.dto';
import { Trade } from './entities/trade.entity';
import { TradeData, TradeFilter, TradeRequest } from './trade.interface';

@Injectable()
export class TradeService implements OnModuleInit {
  private readonly MINIMUM_TRADE_RATE = 0;
  private readonly COIN_MAJOR_ITEM_COUNT = 2;
  private readonly COIN_MINOR_ITEM_COUNT = 5;
  private readonly NASDAQ_ITEM_COUNT = 0;

  private readonly logger = new Logger(TradeService.name);

  // Amazon SQS
  private readonly sqs = new SQSClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  private readonly queueUrl = process.env.AWS_SQS_QUEUE_URL;

  constructor(
    private readonly i18n: I18nService,
    private readonly inferenceService: InferenceService,
    private readonly upbitService: UpbitService,
    private readonly profitService: ProfitService,
    private readonly notifyService: NotifyService,
    private readonly historyService: HistoryService,
    private readonly categoryService: CategoryService,
  ) {}

  async onModuleInit() {
    this.startConsumer();
  }

  private async startConsumer(): Promise<void> {
    this.logger.log(this.i18n.t('logging.sqs.consumer.start'));

    try {
      await this.consumeMessage();
    } catch (error) {
      this.logger.error(this.i18n.t('logging.sqs.consumer.error', { args: { error } }));
      this.logger.log(this.i18n.t('logging.sqs.consumer.restart'));

      setTimeout(() => this.startConsumer(), 5000);
    }
  }

  private async consumeMessage(): Promise<void> {
    this.logger.log(this.i18n.t('logging.sqs.consumer.start'));

    while (true) {
      try {
        const result = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: 10,
            WaitTimeSeconds: 20,
          }),
        );

        if (!result.Messages?.length) continue;

        this.logger.log(
          this.i18n.t('logging.sqs.consumer.processing', {
            args: { count: result.Messages.length },
          }),
        );

        await Promise.all(result.Messages.map((message) => this.handleMessage(message)));
      } catch (error) {
        this.logger.error(this.i18n.t('logging.sqs.consumer.error', { args: { error } }));
      }
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    const messageId = message.MessageId;
    this.logger.log(this.i18n.t('logging.sqs.message.start', { args: { id: messageId } }));

    try {
      const { user, inferences, buyAvailable } = JSON.parse(message.Body);

      // 포트폴리오 조정 실행
      const trades = await this.processUserItems(user, inferences, buyAvailable);
      this.logger.debug(trades);

      // 수익금 알림
      const profitData = await this.profitService.getProfit(user);

      await this.notifyService.notify(
        user,
        this.i18n.t('notify.profit.result', {
          args: {
            profit: formatNumber(profitData.profit),
          },
        }),
      );

      this.logger.log(this.i18n.t('logging.sqs.message.complete', { args: { id: messageId } }));

      // 메시지 삭제
      await this.sqs.send(
        new DeleteMessageCommand({
          QueueUrl: this.queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );

      this.logger.log(this.i18n.t('logging.sqs.message.delete', { args: { id: messageId } }));
    } catch (error) {
      this.logger.error(
        this.i18n.t('logging.sqs.message.error', {
          args: { id: messageId, error },
        }),
      );
      throw error;
    }
  }

  public async produceMessage(
    users: User[],
    inferences: BalanceRecommendationData[],
    buyAvailable: boolean = true,
  ): Promise<void> {
    this.logger.log(
      this.i18n.t('logging.sqs.producer.start', {
        args: { count: users.length },
      }),
    );

    try {
      const messages = users.map(
        (user) =>
          new SendMessageCommand({
            QueueUrl: this.queueUrl,
            MessageBody: JSON.stringify({ user, inferences, buyAvailable }),
          }),
      );

      const results = await Promise.all(messages.map((message) => this.sqs.send(message)));
      this.logger.debug(results);
      this.logger.log(this.i18n.t('logging.sqs.producer.complete'));
    } catch (error) {
      this.logger.error(this.i18n.t('logging.sqs.producer.error', { args: { error } }));
      throw error;
    }
  }

  public async executeBalanceRecommendations(items: RecommendationItem[]): Promise<BalanceRecommendationData[]> {
    const recommendations = await this.inferenceService.balanceRecommendation(items);

    return recommendations.filter((item) => item !== null);
  }

  public async filterUserAuthorizedBalanceRecommendations(
    user: User,
    inferences: BalanceRecommendationData[],
  ): Promise<BalanceRecommendationData[]> {
    const enabledCategories = await this.categoryService.findEnabledByUser(user);

    return inferences.filter(
      (item) =>
        this.categoryService.checkCategoryPermission(user, item.category) &&
        enabledCategories.some((uc) => uc.category === item.category),
    );
  }

  public filterIncludedBalanceRecommendations(inferences: BalanceRecommendationData[]): BalanceRecommendationData[] {
    const results = this.groupBalanceRecommendationsByCategory(inferences).map(
      ([category, categoryBalanceRecommendations]) =>
        this.getIncludedBalanceRecommendationsByCategory(categoryBalanceRecommendations, category as Category),
    );
    return this.mergeSortedBalanceRecommendations(results);
  }

  public filterExcludedBalanceRecommendations(inferences: BalanceRecommendationData[]): BalanceRecommendationData[] {
    const results = this.groupBalanceRecommendationsByCategory(inferences).map(
      ([category, categoryBalanceRecommendations]) =>
        this.getExcludedBalanceRecommendationsByCategory(categoryBalanceRecommendations, category as Category),
    );
    return this.mergeSortedBalanceRecommendations(results);
  }

  private groupBalanceRecommendationsByCategory(
    inferences: BalanceRecommendationData[],
  ): Array<[string, BalanceRecommendationData[]]> {
    return Object.entries(
      inferences.reduce(
        (acc, curr) => {
          if (!acc[curr.category]) {
            acc[curr.category] = [];
          }
          acc[curr.category].push(curr);
          return acc;
        },
        {} as Record<string, BalanceRecommendationData[]>,
      ),
    );
  }

  private getIncludedBalanceRecommendationsByCategory(
    categoryBalanceRecommendations: BalanceRecommendationData[],
    category: Category,
  ): BalanceRecommendationData[] {
    return this.sortBalanceRecommendations(categoryBalanceRecommendations)
      .filter((item) => item.rate > this.MINIMUM_TRADE_RATE)
      .slice(0, this.getItemCountByCategory(category));
  }

  private getExcludedBalanceRecommendationsByCategory(
    categoryBalanceRecommendations: BalanceRecommendationData[],
    category: Category,
  ): BalanceRecommendationData[] {
    const includedBalanceRecommendations = this.getIncludedBalanceRecommendationsByCategory(
      categoryBalanceRecommendations,
      category as Category,
    );
    return this.sortBalanceRecommendations(categoryBalanceRecommendations).filter(
      (item) => !includedBalanceRecommendations.includes(item),
    );
  }

  private sortBalanceRecommendations(inferences: BalanceRecommendationData[]): BalanceRecommendationData[] {
    return inferences.sort((a, b) => {
      if (a.hasStock && b.hasStock) {
        return 0;
      } else if (a.hasStock) {
        return -1;
      } else if (b.hasStock) {
        return 1;
      }

      const rateDiff = b.rate - a.rate;

      if (Math.abs(rateDiff) < Number.EPSILON) {
        return 0;
      }

      return rateDiff;
    });
  }

  private mergeSortedBalanceRecommendations(results: BalanceRecommendationData[][]): BalanceRecommendationData[] {
    return this.sortBalanceRecommendations(results.flat());
  }

  public generateNonBalanceRecommendationTradeRequests(
    balances: Balances,
    inferences: BalanceRecommendationData[],
  ): TradeRequest[] {
    const tradeRequests: TradeRequest[] = balances.info
      .filter((item) => {
        const symbol = `${item.currency}/${item.unit_currency}`;
        return item.currency !== item.unit_currency && !inferences.some((inference) => inference.symbol === symbol);
      })
      .map((item) => ({
        symbol: `${item.currency}/${item.unit_currency}`,
        diff: -1,
        balances,
      }));

    return tradeRequests;
  }

  public generateIncludedTradeRequests(
    balances: Balances,
    inferences: BalanceRecommendationData[],
    count: number,
  ): TradeRequest[] {
    const filteredBalanceRecommendations = this.filterIncludedBalanceRecommendations(inferences).slice(0, count);

    const tradeRequests: TradeRequest[] = filteredBalanceRecommendations
      .map((inference) => ({
        symbol: inference.symbol,
        diff: this.calculateDiff(balances, inference.symbol, inference.rate / count, inference.category),
        balances,
        inference,
      }))
      .sort((a, b) => a.diff - b.diff); // 오름차순으로 정렬

    return tradeRequests;
  }

  public generateExcludedTradeRequests(
    balances: Balances,
    inferences: BalanceRecommendationData[],
    count: number,
  ): TradeRequest[] {
    const filteredBalanceRecommendations = [
      ...this.filterIncludedBalanceRecommendations(inferences).slice(count),
      ...this.filterExcludedBalanceRecommendations(inferences),
    ];

    const tradeRequests: TradeRequest[] = filteredBalanceRecommendations.map((inference) => ({
      symbol: inference.symbol,
      diff: -1,
      balances,
      inference,
    }));

    return tradeRequests;
  }

  public calculateDiff(balances: Balances, symbol: string, rate: number, category: Category): number {
    switch (category) {
      case Category.COIN_MAJOR:
      case Category.COIN_MINOR:
        return this.upbitService.calculateDiff(balances, symbol, rate);
    }

    return 0;
  }

  public async processItems(users: User[], items: RecommendationItem[], buyAvailable: boolean = true): Promise<void> {
    // 추론 실행
    const inferences = await this.executeBalanceRecommendations(items);

    // 큐에 메시지 전송
    await this.produceMessage(users, inferences, buyAvailable);

    // 현재 포트폴리오 저장
    await this.historyService.saveHistory(
      this.filterIncludedBalanceRecommendations(inferences).map((inference, index) => ({
        ...inference,
        index,
      })),
    );

    // 클라이언트 초기화
    this.clearClients();
  }

  public async processUserItems(
    user: User,
    inferences: BalanceRecommendationData[],
    buyAvailable: boolean = true,
  ): Promise<Trade[]> {
    // 권한이 있는 추론만 필터링
    const authorizedBalanceRecommendations = await this.filterUserAuthorizedBalanceRecommendations(user, inferences);

    await this.notifyService.notify(
      user,
      this.i18n.t('notify.inference.result', {
        args: {
          transactions: authorizedBalanceRecommendations
            .map((recommendation) =>
              this.i18n.t('notify.inference.transaction', {
                args: {
                  symbol: recommendation.symbol,
                  rate: Math.floor(recommendation.rate * 100),
                },
              }),
            )
            .join('\n'),
        },
      }),
    );

    // 종목 개수 계산
    const count = await this.getItemCount(user);

    // 유저 계좌 조회
    const balances = await this.upbitService.getBalances(user);

    if (!balances) return [];

    // 편입/편출 결정 분리
    const nonBalanceRecommendationTradeRequests: TradeRequest[] = this.generateNonBalanceRecommendationTradeRequests(
      balances,
      authorizedBalanceRecommendations,
    );

    const excludedTradeRequests: TradeRequest[] = this.generateExcludedTradeRequests(
      balances,
      authorizedBalanceRecommendations,
      count,
    );

    let includedTradeRequests: TradeRequest[] = this.generateIncludedTradeRequests(
      balances,
      authorizedBalanceRecommendations,
      count,
    );

    if (!buyAvailable) {
      includedTradeRequests = includedTradeRequests.filter((item) => item.diff < 0);
    }

    // 편출 처리
    const nonBalanceRecommendationTrades: Trade[] = await Promise.all(
      nonBalanceRecommendationTradeRequests.map((request) => this.executeTrade(user, request)),
    );

    const excludedTrades: Trade[] = await Promise.all(
      excludedTradeRequests.map((request) => this.executeTrade(user, request)),
    );

    // 편입 처리
    const includedTrades: Trade[] = await Promise.all(
      includedTradeRequests.map((request) => this.executeTrade(user, request)),
    );

    // 메시지 전송
    const allTrades: Trade[] = [...nonBalanceRecommendationTrades, ...excludedTrades, ...includedTrades].filter(
      (item) => item !== null,
    );

    if (allTrades.length > 0) {
      await this.notifyService.notify(
        user,
        this.i18n.t('notify.order.result', {
          args: {
            transactions: allTrades
              .map((trade) =>
                this.i18n.t('notify.order.transaction', {
                  args: {
                    symbol: trade.symbol,
                    type: this.i18n.t(`label.order.type.${trade.type}`),
                    amount: formatNumber(trade.amount),
                    profit: formatNumber(trade.profit),
                  },
                }),
              )
              .join('\n'),
          },
        }),
      );
    }

    // 클라이언트 초기화
    this.clearClients();

    return allTrades;
  }

  private async getItemCount(user: User): Promise<number> {
    const userCategories = await this.categoryService.findEnabledByUser(user);
    const categories = userCategories.map((uc) => uc.category);

    const authorizedCategories = categories.filter((category) =>
      this.categoryService.checkCategoryPermission(user, category),
    );

    if (authorizedCategories.length < 1) {
      return 0;
    }

    return Math.max(...authorizedCategories.map((category) => this.getItemCountByCategory(category)));
  }

  private getItemCountByCategory(category: Category): number {
    switch (category) {
      case Category.COIN_MAJOR:
        return this.COIN_MAJOR_ITEM_COUNT;

      case Category.COIN_MINOR:
        return this.COIN_MINOR_ITEM_COUNT;

      case Category.NASDAQ:
        return this.NASDAQ_ITEM_COUNT;
    }

    return 0;
  }

  public clearClients(): void {
    this.upbitService.clearClients();
    this.notifyService.clearClients();
  }

  public async executeTrade(user: User, request: TradeRequest): Promise<Trade> {
    this.logger.log(this.i18n.t('logging.trade.start', { args: { id: user.id, symbol: request.symbol } }));

    const order = await this.upbitService.adjustOrder(user, request);

    if (!order) {
      this.logger.log(this.i18n.t('logging.trade.not_exist', { args: { id: user.id, symbol: request.symbol } }));
      return null;
    }

    this.logger.log(this.i18n.t('logging.trade.calculate.start', { args: { id: user.id, symbol: request.symbol } }));

    const type = this.upbitService.getOrderType(order);
    const amount = await this.upbitService.calculateAmount(order);
    const profit = await this.upbitService.calculateProfit(request.balances, order, amount);

    this.logger.log(
      this.i18n.t('logging.trade.calculate.end', {
        args: {
          id: user.id,
          symbol: request.symbol,
          type: this.i18n.t(`label.order.type.${type}`),
          amount,
          profit,
        },
      }),
    );

    this.logger.log(this.i18n.t('logging.trade.save.start', { args: { id: user.id, symbol: request.symbol } }));

    const trade = await this.saveTrade(user, {
      symbol: request.symbol,
      type,
      amount,
      profit,
      inference: request.inference,
    });

    this.logger.log(this.i18n.t('logging.trade.save.end', { args: { id: user.id, symbol: request.symbol } }));

    return trade;
  }

  public async saveTrade(user: User, data: TradeData): Promise<Trade> {
    const trade = new Trade();

    Object.assign(trade, data);
    trade.user = user;

    return trade.save();
  }

  public async createTradeFromUserRequest(user: User, request: PostTradeDto): Promise<Trade> {
    const balances = await this.upbitService.getBalances(user);

    return this.executeTrade(user, {
      ...request,
      balances,
    });
  }

  public async paginateTrades(user: User, request: ItemRequest): Promise<PaginatedItem<Trade>> {
    return Trade.paginate(user, request);
  }

  public async cursorTrades(
    user: User,
    request: CursorRequest<string> & TradeFilter,
  ): Promise<CursorItem<Trade, string>> {
    return Trade.cursor(user, request);
  }
}
