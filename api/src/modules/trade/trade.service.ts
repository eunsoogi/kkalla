import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { Order } from 'ccxt';

import { RequestInferenceDto } from '../inference/dto/request-inference.dto';
import { InferenceDicisionTypes } from '../inference/inference.interface';
import { InferenceService } from '../inference/inference.service';
import { BalanceTypes, OrderTypes } from '../upbit/upbit.interface';
import { UpbitService } from '../upbit/upbit.service';
import { CreateTradeDto } from './dto/create-trade.dto';
import { Trade } from './entities/trade.entity';
import { TradeTypes } from './trade.interface';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  constructor(
    private readonly inferenceService: InferenceService,
    private readonly upbitService: UpbitService,
  ) {}

  @Cron(CronExpression.EVERY_4_HOURS)
  public async trade() {
    // Inference
    const inference = await this.inferenceService.inferenceAndSave(new RequestInferenceDto());

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

    if (!orderType) {
      return null;
    }

    const order = await this.upbitService.order(orderType, inference.rate);

    // Record
    const balanceKRW = await this.upbitService.getBalance(BalanceTypes.KRW);
    const balanceBTC = await this.upbitService.getBalance(BalanceTypes.BTC);

    const trade = await this.create({
      type: TradeTypes[order.side],
      symbol: order.symbol,
      cost: order.cost,
      balance: {
        krw: balanceKRW,
        coin: balanceBTC,
      },
      inference: inference,
    });

    this.logger.log(`${inference.decision} trade occured. rate: ${inference.rate}`);

    return trade;
  }

  public async create(createInferenceDto: CreateTradeDto): Promise<Trade> {
    const trade = new Trade();

    Object.entries(createInferenceDto).forEach(([key, value]) => (trade[key] = value));
    await trade.save();

    return trade;
  }
}
