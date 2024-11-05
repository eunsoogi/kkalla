import { Injectable, Logger } from '@nestjs/common';

import { ItemRequest, PaginatedItem } from '@/interfaces/item.interface';

import { INFERENCE_MESSAGE_CONFIG } from '../inference/inference.config';
import { InferenceDicisionTypes } from '../inference/inference.enum';
import { InferenceService } from '../inference/inference.service';
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
  ) {}

  public async trade(user: User): Promise<Trade> {
    this.logger.log(`Inference for ${user.id} started...`);

    // TO-DO: dynamic symbol
    const symbol = 'BTC';
    const market = 'KRW';

    // Inference
    const inference = await this.inferenceService.inferenceAndSave(user, {
      ...INFERENCE_MESSAGE_CONFIG,
      symbol,
      market,
    });

    // Order
    let orderType: OrderTypes;

    switch (inference.decision) {
      case InferenceDicisionTypes.BUY:
        orderType = OrderTypes.BUY;
        break;

      case InferenceDicisionTypes.SELL:
        orderType = OrderTypes.SELL;
        break;
    }

    this.logger.log(`Inference for ${user.id} has ended.`);

    if (!orderType) {
      return null;
    }

    this.logger.log(`Order for ${user.id} started...`);

    const order = await this.upbitService.order(user, {
      symbol,
      market,
      type: orderType,
      rate: inference.rate,
    });

    // Record trade history
    const balances = await this.upbitService.getBalances(user);

    const trade = await this.create(user, {
      type: orderType,
      symbol,
      market,
      amount: order?.amount ?? order?.cost,
      balances,
      inference,
    });

    this.logger.log(`Order for ${user.id} has ended. decision: ${inference.decision}, rate: ${inference.rate}`);

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
