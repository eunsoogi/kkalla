import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { FindItemDto } from '@/dto/find-item.dto';
import { PaginatedItemDto } from '@/dto/paginated-item.dto';

import { RequestInferenceDto } from '../inferences/dto/request-inference.dto';
import { InferenceService } from '../inferences/inference.service';
import { InferenceDicisionTypes } from '../inferences/inference.type';
import { UpbitService } from '../upbit/upbit.service';
import { BalanceTypes, OrderTypes } from '../upbit/upbit.type';
import { User } from '../user/entities/user.entity';
import { CreateTradeDto } from './dto/create-trade.dto';
import { Trade } from './entities/trade.entity';
import { TradeTypes } from './trade.type';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  constructor(
    private readonly inferenceService: InferenceService,
    private readonly upbitService: UpbitService,
  ) {}

  @Cron(CronExpression.EVERY_4_HOURS)
  public async tradeSchedule(): Promise<Trade[]> {
    this.logger.log('Trade schedule started...');

    const users = await User.find();
    const threads = users.map((user) => this.trade(user));
    const results = await Promise.all(threads);

    this.logger.log('Trade schedule has ended.');

    return results;
  }

  public async trade(user: User): Promise<Trade> {
    this.logger.log(`Inference for ${user.id} started...`);

    // Inference
    const inference = await this.inferenceService.inferenceAndSave(user, new RequestInferenceDto());

    // Order
    let orderType: OrderTypes;
    let tradeType: TradeTypes;

    switch (inference.decision) {
      case InferenceDicisionTypes.BUY:
        orderType = OrderTypes.BUY;
        tradeType = TradeTypes.BUY;
        break;

      case InferenceDicisionTypes.SELL:
        orderType = OrderTypes.SELL;
        tradeType = TradeTypes.SELL;
        break;
    }

    this.logger.log(`Inference for ${user.id} has ended.`);

    if (!orderType) {
      return null;
    }

    this.logger.log(`Order for ${user.id} started...`);

    const order = await this.upbitService.order(user, orderType, inference.rate);

    // Record
    const balanceKRW = await this.upbitService.getBalance(user, BalanceTypes.KRW);
    const balanceBTC = await this.upbitService.getBalance(user, BalanceTypes.BTC);

    const trade = await this.create(user, {
      type: tradeType,
      symbol: order.symbol,
      amount: order?.amount ?? order?.cost,
      balance: {
        krw: balanceKRW,
        coin: balanceBTC,
      },
      inference: inference,
    });

    this.logger.log(`Order for ${user.id} has ended. decision: ${inference.decision}, rate: ${inference.rate}`);

    return trade;
  }

  public async create(user: User, createInferenceDto: CreateTradeDto): Promise<Trade> {
    const trade = new Trade();

    trade.user = user;
    Object.entries(createInferenceDto).forEach(([key, value]) => (trade[key] = value));

    return trade.save();
  }

  public async paginate(user: User, findItemDto: FindItemDto): Promise<PaginatedItemDto<Trade>> {
    return Trade.paginate(user, findItemDto);
  }
}
