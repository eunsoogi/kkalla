import { Controller, Post } from '@nestjs/common';

import { TradeService } from './trade.service';

@Controller('api/v1/trades')
export class TradeController {
  constructor(private readonly tradeService: TradeService) {}

  @Post()
  public async request() {
    return await this.tradeService.trade();
  }
}
