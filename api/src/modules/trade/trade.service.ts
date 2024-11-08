import { Injectable, Logger } from '@nestjs/common';

import { Order } from 'ccxt';

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
  ) {}

  public async trade(user: User, request: TradeRequest): Promise<Trade> {
    let inference: Inference;

    this.logger.log(`Inference for ${user.id} started...`);

    try {
      const inferenceData = await this.inference(user, request);
      inference = await this.inferenceService.create(user, inferenceData);
    } catch (error) {
      this.logger.error(`Inference for ${user.id} has failed.`, error);
      this.notifyService.notify(user, '추론에 실패했습니다.');
    }

    this.logger.log(`Inference for ${user.id} has ended.`);

    if (!inference) {
      return null;
    }

    this.notifyService.notify(
      user,
      `추론 결과: \`${inference.decision}\` (${inference.rate * 100}%)\n> ${inference.reason}`,
    );

    let order: Order;

    this.logger.log(`Order for ${user.id} started...`);

    try {
      order = await this.order(user, inference, request);
    } catch (error) {
      this.logger.error(`Order for ${user.id} has failed.`, error);
      this.notifyService.notify(user, '주문에 실패했습니다.');
    }

    this.logger.log(`Order for ${user.id} has ended.`);

    if (!order) {
      return null;
    }

    const type = UpbitService.getOrderType(inference.decision);
    const balances = await this.upbitService.getBalances(user);
    const trade = await this.create(user, {
      ...request,
      type,
      amount: order?.amount ?? order?.cost,
      balances,
      inference,
    });

    this.notifyService.notify(
      user,
      `주문 결과: \`${type}\`\n${trade.symbol}/${trade.market}, ₩${trade.amount.toLocaleString()}`,
    );

    return trade;
  }

  public async inference(user: User, request: TradeRequest): Promise<InferenceData> {
    const rate = await this.upbitService.getCashRate(user);

    const result = await this.inferenceService.inference(user, {
      ...INFERENCE_MESSAGE_CONFIG,
      ...request,
    });

    return result.items.filter((item) => item.cashLessThan > rate && item.cashMoreThan < rate)[0];
  }

  public async order(user: User, inference: Inference, request: TradeRequest): Promise<Order> {
    const type = UpbitService.getOrderType(inference.decision);

    if (!type) {
      return null;
    }

    const result = await this.upbitService.order(user, {
      ...request,
      type,
      rate: inference.rate,
    });

    return result;
  }

  public async create(user: User, data: TradeData): Promise<Trade> {
    const trade = new Trade();

    trade.user = user;
    Object.entries(data).forEach(([key, value]) => (trade[key] = value));

    return trade.save();
  }

  public async paginate(user: User, request: ItemRequest): Promise<PaginatedItem<Trade>> {
    return Trade.paginate(user, request);
  }
}
