import { Injectable, Logger } from '@nestjs/common';

import { Order } from 'ccxt';
import { I18nService } from 'nestjs-i18n';

import { ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { Inference } from '../inference/entities/inference.entity';
import { INFERENCE_CONFIG } from '../inference/inference.config';
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

  public async inference(request: TradeRequest): Promise<Inference[]> {
    return this.performInference(request);
  }

  public async trade(user: User, inferences: Inference[], request: TradeRequest): Promise<Trade> {
    const inference = await this.selectInference(user, inferences, request);

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

  private async performInference(request: TradeRequest): Promise<Inference[]> {
    this.logger.log(this.i18n.t('logging.inference.start'));

    try {
      const data = await this.inferenceService.inference({
        ...INFERENCE_CONFIG.message,
        ...request,
      });

      const items = data.decisions.map((item) => ({
        ...data,
        ...item,
      }));

      const entities = await Promise.all(items.map((item) => this.inferenceService.create(item)));

      return entities;
    } catch (error) {
      this.logger.error(this.i18n.t('logging.inference.fail'), error as Error);
    }

    return null;
  }

  private async selectInference(user: User, inferences: Inference[], request: TradeRequest) {
    const rate = await this.upbitService.getSymbolRate(user, request.symbol, request.market);
    const inference = inferences?.find((item) => item.symbolRateLower <= rate && rate <= item.symbolRateUpper);

    if (inference) {
      if (!inference.users) {
        inference.users = [];
      }
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
          rate: inference.rate * 100,
          reason: inference.reason,
        },
      }),
    );
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
      const type = UpbitService.getOrderType(inference.decision);

      if (!type) {
        return null;
      }

      const entity = await this.upbitService.order(user, {
        ...request,
        type,
        rate: inference.rate,
      });

      return entity;
    } catch (error) {
      this.logger.error(
        this.i18n.t('logging.order.fail', {
          args: {
            id: user.id,
          },
        }),
        error as Error,
      );

      this.notifyService.notify(user, this.i18n.t('notify.order.fail'));
    }

    return null;
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
