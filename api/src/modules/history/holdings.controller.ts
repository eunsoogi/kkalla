import { Controller, Get, UseGuards } from '@nestjs/common';

import { GoogleTokenAuthGuard } from '../auth/guards/google.guard';
import { HoldingDto } from './dto/holding.dto';
import { HoldingsService } from './holdings.service';

/**
 * 보유 종목 API (History 테이블 기반)
 */
@Controller('api/v1/holdings')
export class HoldingsController {
  constructor(private readonly holdingsService: HoldingsService) {}

  @Get()
  @UseGuards(GoogleTokenAuthGuard)
  async getHoldings(): Promise<HoldingDto[]> {
    return this.holdingsService.getHoldings();
  }
}
