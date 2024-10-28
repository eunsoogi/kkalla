import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { RequestInferenceDto } from '../inference/dto/request-inference.dto';
import { InferenceDicisionTypes } from '../inference/inference.interface';
import { InferenceService } from '../inference/inference.service';
import { OrderTypes } from '../upbit/upbit.interface';
import { UpbitService } from '../upbit/upbit.service';

@Injectable()
export class TradeService {
  private readonly logger = new Logger(TradeService.name);

  constructor(
    private readonly inferenceService: InferenceService,
    private readonly upbitService: UpbitService,
  ) {}

  @Cron(CronExpression.EVERY_4_HOURS)
  public async trade() {
    const inference = await this.inferenceService.inferenceAndSave(new RequestInferenceDto());

    switch (inference.decision) {
      case InferenceDicisionTypes.BUY:
        this.logger.log(`${inference.decision} trade occured.`);
        return await this.upbitService.order(OrderTypes.BUY, inference.rate);

      case InferenceDicisionTypes.SELL:
        this.logger.log(`${inference.decision} trade occured.`);
        return await this.upbitService.order(OrderTypes.SELL, inference.rate);
    }
  }
}
