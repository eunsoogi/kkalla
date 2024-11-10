import { Injectable, Logger } from '@nestjs/common';

import { Order } from 'ccxt';
import { I18nService } from 'nestjs-i18n';

import { ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { Inference } from '../inference/entities/inference.entity';
import { INFERENCE_MESSAGE_CONFIG } from '../inference/inference.config';
import { InferenceData } from '../inference/inference.interface';
import { InferenceService } from '../inference/inference.service';
import { NotifyService } from '../notify/notify.service';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../user/entities/user.entity';
import { Trade } from './entities/trade.entity';
import { TradeData, TradeRequest } from './trade.interface';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  constructor(
    private readonly inferenceService: InferenceService,
    private readonly upbitService: UpbitService,
    private readonly notifyService: NotifyService,
    private readonly i18n: I18nService,
  ) {}

  public async trade(user: User, request: TradeRequest): Promise<Trade> {
    const inference = await this.performInference(user, request);

    if (!inference) {
      return null;
    }

    this.notifyInferenceResult(user, inference);

    const order = await this.performOrder(user, inference, request);

    if (!order) {
      return null;
    }

    const trade = await this.performTrade(user, request, inference, order);

    this.notifyTradeResult(user, trade);

    return trade;
  }

  public async inference(user: User, request: TradeRequest): Promise<InferenceData> {
    const rate = await this.upbitService.getCashRate(user);
    const result = await this.inferenceService.inference(user, {
      ...INFERENCE_MESSAGE_CONFIG,
      ...request,
    });

    return result.items.find((item) => item.cashLessThan > rate && item.cashMoreThan < rate);
  }

  private async performInference(user: User, request: TradeRequest): Promise<Inference> {
    this.logger.log(
      this.i18n.t('logging.inference.start', {
        args: {
          id: user.id,
        },
      }),
    );

    try {
      const inferenceData = await this.inference(user, request);
      return await this.inferenceService.create(user, inferenceData);
    } catch (error) {
      this.handleError(
        this.i18n.t('logging.inference.for', {
          args: {
            id: user.id,
          },
        }),
        error as Error,
        user,
      );
      return null;
    }
  }

  private notifyInferenceResult(user: User, inference: Inference): void {
    this.notifyService.notify(
      user,
      this.i18n.t('notify.inference.result', {
        args: {
          decision: inference.decision,
          rate: inference.rate * 100,
          reason: inference.reason,
        },
      }),
    );
  }

  public async order(user: User, inference: Inference, request: TradeRequest): Promise<Order> {
    const type = UpbitService.getOrderType(inference.decision);
    if (!type) return null;

    return this.upbitService.order(user, {
      ...request,
      type,
      rate: inference.rate,
    });
  }

  private async performOrder(user: User, inference: Inference, request: TradeRequest): Promise<Order> {
    this.logger.log(
      this.i18n.t('logging.order.start', {
        args: {
          id: user.id,
        },
      }),
    );

    try {
      return await this.order(user, inference, request);
    } catch (error) {
      this.handleError(
        this.i18n.t('logging.order.for', {
          args: {
            id: user.id,
          },
        }),
        error as Error,
        user,
      );
      return null;
    }
  }

  private handleError(context: string, error: Error, user: User): void {
    this.logger.error(
      this.i18n.t('logging.common.fail', {
        args: {
          context,
        },
      }),
      error,
    );

    this.notifyService.notify(
      user,
      this.i18n.t('notify.common.fail', {
        args: {
          context: context.split(' ')[0].toLowerCase(),
        },
      }),
    );
  }

  public async create(user: User, data: TradeData): Promise<Trade> {
    const trade = new Trade();

    trade.user = user;
    Object.assign(trade, data);

    return trade.save();
  }

  private async performTrade(user: User, request: TradeRequest, inference: Inference, order: Order): Promise<Trade> {
    const type = UpbitService.getOrderType(inference.decision);
    const balances = await this.upbitService.getBalances(user);
    const trade = await this.create(user, {
      ...request,
      type,
      amount: order?.amount ?? order?.cost,
      balances,
      inference,
    });

    return trade;
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
