import { Injectable, Logger } from '@nestjs/common';

import { Balances, Order } from 'ccxt';

import { ItemRequest, PaginatedItem } from '@/modules/item/item.interface';

import { Inference } from '../inference/entities/inference.entity';
import { INFERENCE_MESSAGE_CONFIG } from '../inference/inference.config';
import { InferenceDecisionTypes } from '../inference/inference.enum';
import { InferenceService } from '../inference/inference.service';
import { NotifyService } from '../notify/notify.service';
import { OrderTypes } from '../upbit/upbit.enum';
import { UpbitService } from '../upbit/upbit.service';
import { User } from '../user/entities/user.entity';
import { Trade } from './entities/trade.entity';
import { TradeData } from './trade.interface';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  constructor(
    private readonly inferenceService: InferenceService,
    private readonly upbitService: UpbitService,
    private readonly notifyService: NotifyService,
  ) {}

  public async trade(user: User): Promise<Trade> {
    this.logger.log(`Inference for ${user.id} started...`);

    // TO-DO: dynamic symbol
    const symbol = 'BTC';
    const market = 'KRW';

    let inference: Inference;

    // Inference
    try {
      inference = await this.inferenceService.inferenceAndSave(user, {
        ...INFERENCE_MESSAGE_CONFIG,
        symbol,
        market,
      });
    } catch (error) {
      this.logger.error(`Inference for ${user.id} has failed.`, error);

      this.notifyService.create(user, {
        message: '추론에 실패했습니다.',
      });

      return null;
    }

    // Order
    let orderType: OrderTypes;

    switch (inference.decision) {
      case InferenceDecisionTypes.BUY:
        orderType = OrderTypes.BUY;
        break;

      case InferenceDecisionTypes.SELL:
        orderType = OrderTypes.SELL;
        break;
    }

    this.logger.log(`Inference for ${user.id} has ended. decision: ${inference.decision}, rate: ${inference.rate}`);

    this.notifyService.create(user, {
      message: `추론 결과: \`${inference.decision}\` (${inference.rate * 100}%)\n> ${inference.reason}`,
    });

    if (!orderType) {
      return null;
    }

    this.logger.log(`Order for ${user.id} started...`);

    let order: Order;

    try {
      order = await this.upbitService.order(user, {
        symbol,
        market,
        type: orderType,
        rate: inference.rate,
      });
    } catch (error) {
      this.logger.error(`Order for ${user.id} has failed.`, error);

      this.notifyService.create(user, {
        message: '주문에 실패했습니다.',
      });

      return null;
    }

    // Record trade history
    let balances: Balances;

    try {
      balances = await this.upbitService.getBalances(user);
    } catch (error) {
      this.logger.error(`Get balanaces for ${user.id} has failed.`, error);

      this.notifyService.create(user, {
        message: '자산 조회에 실패했습니다.',
      });

      return null;
    }

    const trade = await this.create(user, {
      type: orderType,
      symbol,
      market,
      amount: order?.amount ?? order?.cost,
      balances,
      inference,
    });

    this.logger.log(
      `Order for ${user.id} has ended. type: ${orderType}, ticker: ${trade.symbol}/${trade.market}, amount: ₩${trade.amount.toLocaleString()}`,
    );

    this.notifyService.create(user, {
      message: `주문 결과: \`${orderType}\`\n${trade.symbol}/${trade.market}, ₩${trade.amount.toLocaleString()}`,
    });

    return trade;
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
