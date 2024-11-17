import { Injectable, Logger } from '@nestjs/common';

import { Order } from 'ccxt';
import { I18nService } from 'nestjs-i18n';

import { ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

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

  public async inference(request: TradeRequest): Promise<Inference[]> {
    return this.performInference(request);
  }

  public async trade(user: User, inferences: Inference[], request: TradeRequest): Promise<Trade | null> {
    const inference = await this.selectInference(user, inferences, request);
    if (!inference) return null;

    this.notifyInferenceResult(user, inference);

    const order = await this.performOrder(user, inference, request);
    if (!order) return null;

    const trade = await this.performTrade(user, request, inference, order);
    this.notifyTradeResult(user, trade);

    return trade;
  }

  private async performInference(request: TradeRequest): Promise<Inference[]> {
    this.logger.log(this.i18n.t('logging.inference.start'));
    try {
      const data = await this.inferenceService.inference({
        ...INFERENCE_CONFIG.message,
        ...request,
      });

      return await Promise.all(data.decisions.map((item) => this.inferenceService.create({ ...data, ...item })));
    } catch (error) {
      this.logger.error(this.i18n.t('logging.inference.fail'), error);
    }

    return [];
  }

  private async selectInference(user: User, inferences: Inference[], request: TradeRequest): Promise<Inference | null> {
    const orderRatio = await this.upbitService.getOrderRatio(user, request.symbol);
    const inference = inferences.find(
      (item) => item.weightLowerBound <= orderRatio && orderRatio <= item.weightUpperBound,
    );

    if (inference) {
      inference.users = inference.users || [];
      inference.users.push(user);
      await inference.save();
    }

    return inference;
  }

  private notifyInferenceResult(user: User, inference: Inference): void {
    this.notifyService.notify(
      user,
      this.i18n.t('notify.inference.result', {
        args: {
          decision: inference.decision,
          symbol: inference.symbol,
          orderRatio: inference.orderRatio * 100,
          reason: inference.reason,
        },
      }),
    );
  }

  private async performOrder(user: User, inference: Inference, request: TradeRequest): Promise<Order | null> {
    this.logger.log(this.i18n.t('logging.order.start', { args: { id: user.id } }));
    try {
      const type = UpbitService.getOrderType(inference.decision);
      if (!type) return null;

      return await this.upbitService.order(user, { ...request, type, orderRatio: inference.orderRatio });
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

  private async performTrade(user: User, request: TradeRequest, inference: Inference, order: Order): Promise<Trade> {
    const type = UpbitService.getOrderType(inference.decision);
    const balances = await this.upbitService.getBalances(user);
    return this.create(user, {
      ...request,
      type,
      amount: order?.amount ?? order?.cost,
      balances,
      inference,
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
