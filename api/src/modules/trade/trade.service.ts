import { Injectable, Logger } from '@nestjs/common';

import { Order } from 'ccxt';
import { I18nService } from 'nestjs-i18n';

import { ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { Decision } from '../decision/entities/decision.entity';
import { Inference } from '../inference/entities/inference.entity';
import { INFERENCE_CONFIG } from '../inference/inference.config';
import { InferenceService } from '../inference/inference.service';
import { NotifyService } from '../notify/notify.service';
import { SequenceService } from '../sequence/sequence.service';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../user/entities/user.entity';
import { Trade } from './entities/trade.entity';
import { TradeData, TradeRequest } from './trade.interface';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly sequenceService: SequenceService,
    private readonly inferenceService: InferenceService,
    private readonly upbitService: UpbitService,
    private readonly notifyService: NotifyService,
  ) {}

  public async inference(request: TradeRequest): Promise<Inference> {
    return this.performInference(request);
  }

  public async trade(user: User, inference: Inference, request: TradeRequest): Promise<Trade | null> {
    const decision = await this.selectDecision(user, inference, request);
    if (!decision) return null;

    this.notifyInferenceResult(user, inference, decision);

    const order = await this.performOrder(user, decision, request);
    if (!order) return null;

    const trade = await this.performTrade(user, request, decision, order);
    this.notifyTradeResult(user, trade);

    return trade;
  }

  private async performInference(request: TradeRequest): Promise<Inference> {
    this.logger.log(this.i18n.t('logging.inference.start'));
    try {
      const data = await this.inferenceService.inference({
        ...INFERENCE_CONFIG.message,
        ...request,
      });

      return this.inferenceService.create(data);
    } catch (error) {
      this.logger.error(this.i18n.t('logging.inference.fail'), error);
    }

    return null;
  }

  private async selectDecision(user: User, inference: Inference, request: TradeRequest): Promise<Decision | null> {
    const orderRatio = await this.upbitService.getOrderRatio(user, request.symbol);
    const decision = inference.decisions.find(
      (item) => item.weightLowerBound <= orderRatio && orderRatio <= item.weightUpperBound,
    );

    if (decision) {
      decision.users = decision.users || [];
      decision.users.push(user);
      await decision.save();
    }

    return decision;
  }

  private notifyInferenceResult(user: User, inference: Inference, decision: Decision): void {
    this.notifyService.notify(
      user,
      this.i18n.t('notify.inference.result', {
        args: {
          symbol: inference.symbol,
          decision: decision.decision,
          orderRatio: decision.orderRatio * 100,
          reason: decision.reason,
        },
      }),
    );
  }

  private async performOrder(user: User, decision: Decision, request: TradeRequest): Promise<Order | null> {
    this.logger.log(this.i18n.t('logging.order.start', { args: { id: user.id } }));
    try {
      const type = UpbitService.getOrderType(decision.decision);
      if (!type) return null;

      // @ts-expect-error lazy loading과 관련된 오류이므로 무시
      return await this.upbitService.order(user, { ...request, type, orderRatio: decision.orderRatio });
    } catch (error) {
      this.logger.error(this.i18n.t('logging.order.fail', { args: { id: user.id } }), error);
      this.notifyService.notify(user, this.i18n.t('notify.order.fail'));
    }

    return null;
  }

  public async create(user: User, data: TradeData): Promise<Trade> {
    const trade = new Trade();
    Object.assign(trade, data);
    trade.seq = await this.sequenceService.getNextSequence();
    trade.user = user;
    return trade.save();
  }

  private async performTrade(user: User, request: TradeRequest, decision: Decision, order: Order): Promise<Trade> {
    const type = UpbitService.getOrderType(decision.decision);
    const balances = await this.upbitService.getBalances(user);
    return this.create(user, {
      ...request,
      type,
      amount: order?.amount ?? order?.cost,
      balances,
      decision,
    });
  }

  private notifyTradeResult(user: User, trade: Trade): void {
    this.notifyService.notify(
      user,
      this.i18n.t('notify.order.result', {
        args: {
          type: trade.type,
          symbol: trade.symbol,
          market: trade.market,
          amount: trade.amount.toLocaleString(),
        },
      }),
    );
  }

  public async paginate(user: User, request: ItemRequest): Promise<PaginatedItem<Trade>> {
    return Trade.paginate(user, request);
  }
}
