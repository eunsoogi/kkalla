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
import { Inference } from '../inference/entities/inference.entity';
import { InferenceCategory } from '../inference/inference.enum';
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
import { TradeHistory } from './entities/trade-history.entity';
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
    priceRateUpper: 0.02,
  };
  private readonly MINIMUM_TRADE_RATE = 0.6;
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
  ) {}

  async onModuleInit() {
    this.startConsumer();
  }

  private async startConsumer(): Promise<void> {
    this.logger.log(this.i18n.t('logging.sqs.consumer.start'));

    try {
      await this.consumer();
    } catch (error) {
      this.logger.error(this.i18n.t('logging.sqs.consumer.error', { args: { error } }));
      this.logger.log(this.i18n.t('logging.sqs.consumer.restart'));

      setTimeout(() => this.startConsumer(), 5000);
    }
  }

  private async consumer(): Promise<void> {
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

        await Promise.all(result.Messages.map((message) => this.consume(message)));
      } catch (error) {
        this.logger.error(this.i18n.t('logging.sqs.consumer.error', { args: { error } }));
      }
    }
  }

  private async consume(message: Message): Promise<void> {
    const messageId = message.MessageId;
    this.logger.log(this.i18n.t('logging.sqs.message.start', { args: { id: messageId } }));

    try {
      const { user, inferences } = JSON.parse(message.Body);

      // 포트폴리오 조정 실행
      const trades = await this.adjustPortfolio(user, inferences);
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

  public async produce(users: User[], inferences: Inference[]): Promise<void> {
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

  public async getInferenceItems(): Promise<InferenceItem[]> {
    const items = [
      ...(await this.getInferenceItemFromTradeHistory()),
      ...(await this.getInferenceItemByCoinMajor()),
      ...(await this.getInferenceItemByCoinMinor()),
      ...(await this.getInferenceItemByNasdaq()),
    ];

    const filteredItems = items.filter(
      (item, index, self) => index === self.findIndex((t) => t.ticker === item.ticker),
    );

    return filteredItems;
  }

  private async getInferenceItemFromTradeHistory(): Promise<InferenceItem[]> {
    const items = await TradeHistory.find();

    return items.map((item) => ({
      ticker: item.ticker,
      category: item.category,
    }));
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

  public async performInferences(): Promise<Inference[]> {
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

  public getIncludedInferences(inferences: Inference[]): Inference[] {
    const filteredInferences = inferences
      .filter((item) => item.rate >= this.MINIMUM_TRADE_RATE) // 매매 비율 제한
      .sort((a, b) => b.rate - a.rate) // 내림차순으로 정렬
      .slice(0, this.TOP_INFERENCE_COUNT); // 포트폴리오 개수 제한

    return filteredInferences;
  }

  public getIncludedTradeRequests(balances: Balances, inferences: Inference[], count: number): TradeRequest[] {
    const filteredInferences = this.getIncludedInferences(inferences);

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

  public getExcludedInferences(inferences: Inference[]): Inference[] {
    const filteredInferences = inferences
      .sort((a, b) => b.rate - a.rate) // 내림차순으로 정렬
      .filter((item, index) => item.rate < this.MINIMUM_TRADE_RATE || index >= this.TOP_INFERENCE_COUNT) // 매매 비율 또는 포트폴리오 개수 제한
      .sort((a, b) => a.rate - b.rate); // 오름차순으로 정렬

    return filteredInferences;
  }

  public getExcludedTradeRequests(balances: Balances, inferences: Inference[]): TradeRequest[] {
    const filteredInferences = this.getExcludedInferences(inferences);

    const tradeRequests: TradeRequest[] = filteredInferences.map((inference) => ({
      ticker: inference.ticker,
      diff: -1,
      balances,
      inference,
    }));

    return tradeRequests;
  }

  public async adjustPortfolios(users: User[]): Promise<void> {
    const inferences = await this.performInferences();

    // 큐에 메시지 전송
    await this.produce(users, inferences);

    // 현재 포트폴리오 저장
    const includedInferences = this.getIncludedInferences(inferences);
    await this.createTradeHistory(includedInferences);

    // 클라이언트 초기화
    this.clearClient();
  }

  public async adjustPortfolio(user: User, inferences: Inference[]): Promise<Trade[]> {
    // 권한이 있는 추론만 필터링
    const authorizedInferences = this.getAuthorizedInferences(user, inferences);

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
    const nonInferenceTradeRequests: TradeRequest[] = this.getNonInferenceTradeRequests(balances, authorizedInferences);
    const excludedTradeRequests: TradeRequest[] = this.getExcludedTradeRequests(balances, authorizedInferences);
    const includedTradeRequests: TradeRequest[] = this.getIncludedTradeRequests(balances, authorizedInferences, count);

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

    // 클라이언트 초기화
    this.clearClient();

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

  public clearClient(): void {
    this.upbitService.clearServerClient();
    this.upbitService.clearClients();
    this.notifyService.clearClients();
  }

  public async trade(user: User, request: TradeRequest): Promise<Trade> {
    const order = await this.upbitService.adjustOrder(user, request);

    if (!order) return null;

    const type = this.upbitService.getOrderType(order);
    const amount = await this.upbitService.calculateAmount(order);
    const profit = await this.upbitService.calculateProfit(request.balances, order, amount);

    const trade = await this.createTrade(user, {
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

  public async createTrade(user: User, data: TradeData): Promise<Trade> {
    const trade = new Trade();

    Object.assign(trade, data);
    trade.seq = await this.sequenceService.getNextSequence();
    trade.user = user;

    return trade.save();
  }

  public async createTradeHistory(items: InferenceItem[]): Promise<TradeHistory[]> {
    await TradeHistory.delete({});

    return TradeHistory.save(
      items.map((item) =>
        TradeHistory.create({
          ticker: item.ticker,
          category: item.category,
        }),
      ),
    );
  }

  public async postTrade(user: User, request: PostTradeDto): Promise<Trade> {
    const balances = await this.upbitService.getBalances(user);

    return this.trade(user, {
      ...request,
      balances,
    });
  }

  public async paginate(user: User, request: ItemRequest): Promise<PaginatedItem<Trade>> {
    return Trade.paginate(user, request);
  }

  public async cursor(user: User, request: CursorRequest<string> & TradeFilter): Promise<CursorItem<Trade, string>> {
    return Trade.cursor(user, request);
  }
}
