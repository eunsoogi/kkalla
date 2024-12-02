import { Injectable, Logger } from '@nestjs/common';

import { Order } from 'ccxt';
import { I18nService } from 'nestjs-i18n';

import { ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { DecisionTypes } from '../decision/decision.enum';
import { Decision } from '../decision/entities/decision.entity';
import { Inference } from '../inference/entities/inference.entity';
import { INFERENCE_CONFIG } from '../inference/inference.config';
import { InferenceCategory } from '../inference/inference.enum';
import { InferenceService } from '../inference/inference.service';
import { NotifyService } from '../notify/notify.service';
import { Permission } from '../permission/permission.enum';
import { SequenceService } from '../sequence/sequence.service';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../user/entities/user.entity';
import { Trade } from './entities/trade.entity';
import { InferenceWithDecision, Ticker, TradeData } from './trade.interface';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  private readonly coinMajor = [
    { symbol: 'BTC', market: 'KRW' },
    { symbol: 'ETH', market: 'KRW' },
  ] as const;

  constructor(
    private readonly i18n: I18nService,
    private readonly sequenceService: SequenceService,
    private readonly inferenceService: InferenceService,
    private readonly upbitService: UpbitService,
    private readonly notifyService: NotifyService,
  ) {}

  public async infers(): Promise<Inference[]> {
    const infers = await Promise.all([this.inferByCoinMajor(), this.inferByCoinMinor(), this.inferByNasdaq()]);
    return infers.flat();
  }

  private async inferByCoinMajor(): Promise<Inference[]> {
    return Promise.all(this.coinMajor.map((coin) => this.performInfer(coin, InferenceCategory.COIN_MAJOR)));
  }

  // TO-DO: 마이너 코인 종목 추론
  private async inferByCoinMinor(): Promise<Inference[]> {
    return Promise.all([]);
  }

  // TO-DO: NASDAQ 종목 추론
  private async inferByNasdaq(): Promise<Inference[]> {
    return Promise.all([]);
  }

  private async performInfer(ticker: Ticker, category: InferenceCategory): Promise<Inference> {
    this.logger.log(this.i18n.t('logging.inference.start'));
    try {
      const data = await this.inferenceService.infer({
        ...INFERENCE_CONFIG.message,
        ...ticker,
      });

      return this.inferenceService.create({
        ...data,
        category,
      });
    } catch (error) {
      this.logger.error(this.i18n.t('logging.inference.fail'), error);
    }
    return null;
  }

  public async tradeWithUsers(users: User[]): Promise<Trade[]> {
    const infers = await this.infers();
    const trades = await Promise.all(users.map((user) => this.tradeAll(user, infers)));
    return trades.flat();
  }

  public async tradeAll(user: User, infers: Inference[]): Promise<Trade[]> {
    // 권한이 있는 추론만 필터링
    const authorizedInfers = infers.filter((infer) => this.validateCategoryPermission(user, infer.category));

    // 각 추론에 대한 결정 선택
    const infersWithDecisions: InferenceWithDecision[] = await Promise.all(
      authorizedInfers.map(async (infer) => {
        const decision = await this.selectDecision(user, infer);
        return { infer, decision };
      }),
    );

    // 결정이 있는 추론만 필터링
    const validInfers: InferenceWithDecision[] = infersWithDecisions.filter((item) => item.decision !== null);

    // 매도/매수 결정 분리
    const sellInfers: InferenceWithDecision[] = validInfers.filter(
      (item) => item.decision.decision === DecisionTypes.SELL,
    );
    const buyInfers: InferenceWithDecision[] = validInfers.filter(
      (item) => item.decision.decision === DecisionTypes.BUY,
    );

    // 매수 결정의 orderRatio 조정
    this.adjustBuyRatio(buyInfers);

    // 매도 먼저 처리
    const sellTrades = await Promise.all(sellInfers.map(({ infer, decision }) => this.trade(user, infer, decision)));

    // 매수 처리
    const buyTrades = await Promise.all(buyInfers.map(({ infer, decision }) => this.trade(user, infer, decision)));

    return [...sellTrades, ...buyTrades].filter((item) => item !== null);
  }

  private adjustBuyRatio(infers: InferenceWithDecision[]): void {
    const buyCount = infers.length;
    if (buyCount > 0) {
      infers.forEach((item) => {
        item.decision.orderRatio = item.decision.orderRatio / buyCount;
      });
    }
  }

  public async trade(user: User, infer: Inference, decision: Decision): Promise<Trade> {
    this.notifyInferenceResult(user, infer, decision);

    const order = await this.performOrder(user, infer, decision);
    if (!order) return null;

    const trade = await this.performTrade(user, order, decision);
    this.notifyTradeResult(user, trade);

    return trade;
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
          this.i18n.t('logging.inference.permission.unknown_category', {
            args: { category },
          }),
        );
    }
  }

  private getTicker(ticker: string): Ticker {
    const [symbol, market] = ticker.split('/');

    return {
      symbol,
      market,
    };
  }

  private async selectDecision(user: User, infer: Inference): Promise<Decision | null> {
    const ticker = this.getTicker(infer.ticker);
    const orderRatio = await this.upbitService.getOrderRatio(user, ticker.symbol);

    const decision = infer.decisions.find(
      (item) => item.weightLowerBound <= orderRatio && orderRatio <= item.weightUpperBound,
    );

    if (decision) {
      decision.users = decision.users || [];
      decision.users.push(user);
      await decision.save();
    }

    return decision;
  }

  private async performOrder(user: User, infer: Inference, decision: Decision): Promise<Order | null> {
    this.logger.log(this.i18n.t('logging.order.start', { args: { id: user.id } }));

    try {
      const ticker = this.getTicker(infer.ticker);
      const type = UpbitService.getOrderType(decision.decision);
      // @ts-expect-error lazy loading과 관련된 오류이므로 무시
      return await this.upbitService.order(user, { ...ticker, type, orderRatio: decision.orderRatio });
    } catch (error) {
      this.logger.error(this.i18n.t('logging.order.fail', { args: { id: user.id } }), error);
      return null;
    }
  }

  private async performTrade(user: User, order: Order, decision: Decision): Promise<Trade> {
    const type = UpbitService.getOrderType(decision.decision);
    const balances = await this.upbitService.getBalances(user);
    return this.create(user, {
      ticker: order.symbol,
      type,
      amount: order?.amount ?? order?.cost,
      balances,
      decision,
    });
  }

  private notifyInferenceResult(user: User, inference: Inference, decision: Decision): void {
    this.notifyService.notify(
      user,
      this.i18n.t('notify.inference.result', {
        args: {
          ticker: inference.ticker,
          decision: decision.decision,
          orderRatio: decision.orderRatio * 100,
          reason: inference.reason,
        },
      }),
    );
  }

  private notifyTradeResult(user: User, trade: Trade): void {
    this.notifyService.notify(
      user,
      this.i18n.t('notify.order.result', {
        args: {
          ...trade,
          amount: trade.amount.toLocaleString(),
        },
      }),
    );
  }

  public async create(user: User, data: TradeData): Promise<Trade> {
    const trade = new Trade();

    Object.assign(trade, data);
    trade.seq = await this.sequenceService.getNextSequence();
    trade.user = user;

    return trade.save();
  }

  public async paginate(user: User, request: ItemRequest): Promise<PaginatedItem<Trade>> {
    return Trade.paginate(user, request);
  }
}
