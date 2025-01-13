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

import { AccumulationService } from '../accumulation/accumulation.service';
import { GetAccumulationDto } from '../accumulation/dto/get-accumulation.dto';
import { BlacklistService } from '../blacklist/blacklist.service';
import { Category } from '../category/category.enum';
import { CategoryService } from '../category/category.service';
import { HistoryService } from '../history/history.service';
import { Inference } from '../inference/entities/inference.entity';
import { InferenceItem } from '../inference/inference.interface';
import { InferenceService } from '../inference/inference.service';
import { SortDirection } from '../item/item.enum';
import { NotifyService } from '../notify/notify.service';
import { Permission } from '../permission/permission.enum';
import { ProfitService } from '../profit/profit.service';
import { SequenceService } from '../sequence/sequence.service';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../user/entities/user.entity';
import { PostTradeDto } from './dto/post-trade.dto';
import { Trade } from './entities/trade.entity';
import { TradeData, TradeFilter, TradeRequest } from './trade.interface';

@Injectable()
export class TradeService implements OnModuleInit {
  private readonly COIN_MAJOR = ['BTC/KRW', 'ETH/KRW'] as const;
  private readonly COIN_MINOR_REQUEST: GetAccumulationDto = {
    market: 'KRW',
    open: true,
    distinct: true,
    display: 10,
    order: 'price_rate',
    sortDirection: SortDirection.ASC,
    strengthLower: 0.8,
    priceRateLower: -0.04,
    priceRateUpper: 0.02,
  };
  private readonly MINIMUM_TRADE_RATE = 0;
  private readonly TOP_INFERENCE_COUNT = 5;

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
    private readonly sequenceService: SequenceService,
    private readonly inferenceService: InferenceService,
    private readonly accumulationService: AccumulationService,
    private readonly upbitService: UpbitService,
    private readonly profitService: ProfitService,
    private readonly notifyService: NotifyService,
    private readonly historyService: HistoryService,
    private readonly blacklistService: BlacklistService,
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
      const { user, inferences } = JSON.parse(message.Body);

      // 포트폴리오 조정 실행
      const trades = await this.processUserPortfolio(user, inferences);
      this.logger.debug(trades);

      // 수익금 알림
      const profitData = await this.profitService.getProfit(user);
      this.notifyService.notify(
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

  public async produceMessage(users: User[], inferences: Inference[]): Promise<void> {
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
            MessageBody: JSON.stringify({ user, inferences }),
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

  public async getAllInferenceItems(): Promise<InferenceItem[]> {
    let items = [
      ...(await this.historyService.fetchHistoryInferences()),
      ...(await this.fetchMajorCoinInferences()),
      ...(await this.fetchMinorCoinInferences()),
      ...(await this.fetchNasdaqInferences()),
    ];

    const blacklist = await this.blacklistService.findAll();

    // 중복 및 블랙리스트 제거
    items = items.filter(
      (item, index, self) =>
        index === self.findIndex((t) => t.ticker === item.ticker) &&
        !blacklist.some((t) => t.ticker === item.ticker && t.category === item.category),
    );

    return items;
  }

  private async fetchMajorCoinInferences(): Promise<InferenceItem[]> {
    return this.COIN_MAJOR.map((ticker) => ({
      ticker,
      category: Category.COIN_MAJOR,
      hasStock: false,
    }));
  }

  private async fetchMinorCoinInferences(): Promise<InferenceItem[]> {
    const items = await this.accumulationService.getAllAccumulations(this.COIN_MINOR_REQUEST);

    return items.map((item) => ({
      ticker: `${item.symbol}/${item.market}`,
      category: Category.COIN_MINOR,
      hasStock: false,
    }));
  }

  // TO-DO: NASDAQ 종목 추론
  private async fetchNasdaqInferences(): Promise<InferenceItem[]> {
    return [];
  }

  public async executeInferences(): Promise<Inference[]> {
    const items = await this.getAllInferenceItems();

    // 추론 사전 캐싱
    await Promise.all(items.map((item) => this.inferenceService.cacheInference(item)));

    // 추론 수행
    const inferences = await Promise.all(items.map((item) => this.inferenceService.getInference(item)));

    return inferences.filter((item) => item !== null);
  }

  public async filterUserAuthorizedInferences(user: User, inferences: Inference[]): Promise<Inference[]> {
    const enabledCategories = await this.categoryService.findEnabledByUser(user);

    return inferences.filter(
      (item) =>
        this.checkCategoryPermission(user, item.category) &&
        enabledCategories.some((uc) => uc.category === item.category),
    );
  }

  public filterIncludedInferences(inferences: Inference[]): Inference[] {
    return (
      // 카테고리별 그룹화
      Object.values(
        inferences.reduce(
          (acc, curr) => {
            if (!acc[curr.category]) {
              acc[curr.category] = [];
            }
            acc[curr.category].push(curr);
            return acc;
          },
          {} as Record<string, Inference[]>,
        ),
      )
        // 카테고리별로 필터링 및 정렬 후 최대 종목 개수만큼 선택
        .map((categoryInferences) =>
          categoryInferences
            .filter((item) => item.rate >= this.MINIMUM_TRADE_RATE)
            .sort((a, b) => {
              if (a.hasStock === b.hasStock) {
                return b.rate - a.rate;
              }
              return a.hasStock ? -1 : 1;
            })
            .slice(0, this.TOP_INFERENCE_COUNT),
        )
        .flat()
        // 전체 결과를 다시 한번 정렬
        .sort((a, b) => {
          if (a.hasStock === b.hasStock) {
            return b.rate - a.rate;
          }
          return a.hasStock ? -1 : 1;
        })
    );
  }

  public filterExcludedInferences(inferences: Inference[]): Inference[] {
    return (
      // 카테고리별 그룹화
      Object.values(
        inferences.reduce(
          (acc, curr) => {
            if (!acc[curr.category]) {
              acc[curr.category] = [];
            }
            acc[curr.category].push(curr);
            return acc;
          },
          {} as Record<string, Inference[]>,
        ),
      )
        // 카테고리별로 필터링 및 정렬 후 제외할 항목 선택
        .map((categoryInferences) =>
          categoryInferences
            .sort((a, b) => {
              if (a.hasStock === b.hasStock) {
                return b.rate - a.rate;
              }
              return a.hasStock ? -1 : 1;
            })
            .filter((item, index) => item.rate < this.MINIMUM_TRADE_RATE || index >= this.TOP_INFERENCE_COUNT),
        )
        .flat()
        // 전체 결과를 다시 한번 정렬
        .sort((a, b) => {
          if (a.hasStock === b.hasStock) {
            return b.rate - a.rate;
          }
          return a.hasStock ? -1 : 1;
        })
    );
  }

  public generateNonInferenceTradeRequests(balances: Balances, inferences: Inference[]): TradeRequest[] {
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

  public generateIncludedTradeRequests(balances: Balances, inferences: Inference[], count: number): TradeRequest[] {
    const filteredInferences = this.filterIncludedInferences(inferences).slice(0, this.TOP_INFERENCE_COUNT);

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

  public generateExcludedTradeRequests(balances: Balances, inferences: Inference[]): TradeRequest[] {
    const filteredInferences = this.filterExcludedInferences(inferences).filter(
      (item, index) => item.rate < this.MINIMUM_TRADE_RATE || index >= this.TOP_INFERENCE_COUNT,
    );

    const tradeRequests: TradeRequest[] = filteredInferences.map((inference) => ({
      ticker: inference.ticker,
      diff: -1,
      balances,
      inference,
    }));

    return tradeRequests;
  }

  public calculateDiff(balances: Balances, ticker: string, rate: number, category: Category): number {
    switch (category) {
      case Category.COIN_MAJOR:
      case Category.COIN_MINOR:
        return this.upbitService.calculateDiff(balances, ticker, rate);
    }

    return 0;
  }

  public async processPortfolioAdjustments(users: User[]): Promise<void> {
    // 추론 실행
    const inferences = await this.executeInferences();

    // 큐에 메시지 전송
    await this.produceMessage(users, inferences);

    // 현재 포트폴리오 저장
    await this.historyService.saveHistory(
      this.filterIncludedInferences(inferences).map((inference, index) => ({
        ...inference,
        index,
      })),
    );

    // 클라이언트 초기화
    this.clearClients();
  }

  public async processUserPortfolio(user: User, inferences: Inference[]): Promise<Trade[]> {
    // 권한이 있는 추론만 필터링
    const authorizedInferences = await this.filterUserAuthorizedInferences(user, inferences);

    // 포트폴리오 개수 계산
    const count = Math.min(this.TOP_INFERENCE_COUNT, authorizedInferences.length);

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
    const nonInferenceTradeRequests: TradeRequest[] = this.generateNonInferenceTradeRequests(
      balances,
      authorizedInferences,
    );
    const excludedTradeRequests: TradeRequest[] = this.generateExcludedTradeRequests(balances, authorizedInferences);
    const includedTradeRequests: TradeRequest[] = this.generateIncludedTradeRequests(
      balances,
      authorizedInferences,
      count,
    );

    // 편출 처리
    const nonInferenceTrades: Trade[] = await Promise.all(
      nonInferenceTradeRequests.map((request) => this.executeTrade(user, request)),
    );

    const excludedTrades: Trade[] = await Promise.all(
      excludedTradeRequests.map((request) => this.executeTrade(user, request)),
    );

    // 편입 처리
    const includedTrades: Trade[] = await Promise.all(
      includedTradeRequests.map((request) => this.executeTrade(user, request)),
    );

    // 클라이언트 초기화
    this.clearClients();

    return [...nonInferenceTrades, ...excludedTrades, ...includedTrades].filter((item) => item !== null);
  }

  private checkCategoryPermission(user: User, category: Category): boolean {
    const userPermissions = user.roles.flatMap((role) => role.permissions || []);
    const requiredPermission = this.getRequiredCategoryPermission(category);
    return userPermissions.includes(requiredPermission);
  }

  private getRequiredCategoryPermission(category: Category): Permission {
    switch (category) {
      case Category.NASDAQ:
        return Permission.TRADE_NASDAQ;

      case Category.COIN_MAJOR:
        return Permission.TRADE_COIN_MAJOR;

      case Category.COIN_MINOR:
        return Permission.TRADE_COIN_MINOR;

      default:
        throw new Error(
          this.i18n.t('logging.inference.unknown_category', {
            args: { category },
          }),
        );
    }
  }

  public clearClients(): void {
    this.upbitService.clearClients();
    this.notifyService.clearClients();
  }

  public async executeTrade(user: User, request: TradeRequest): Promise<Trade> {
    const order = await this.upbitService.adjustOrder(user, request);

    if (!order) return null;

    const type = this.upbitService.getOrderType(order);
    const amount = await this.upbitService.calculateAmount(order);
    const profit = await this.upbitService.calculateProfit(request.balances, order, amount);

    const trade = await this.saveTrade(user, {
      ticker: request.ticker,
      type,
      amount,
      profit,
      inference: request.inference,
    });

    this.notifyService.notify(
      user,
      this.i18n.t('notify.order.result', {
        args: {
          ...trade,
          type: this.i18n.t(`label.order.type.${trade.type}`),
          amount: formatNumber(trade.amount),
          profit: formatNumber(trade.profit),
        },
      }),
    );

    return trade;
  }

  public async saveTrade(user: User, data: TradeData): Promise<Trade> {
    const trade = new Trade();

    Object.assign(trade, data);
    trade.seq = await this.sequenceService.getNextSequence();
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
