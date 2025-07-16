import { Controller, Get, Query } from '@nestjs/common';

import { FeargreedHistoryDto } from './dto/get-feargreed-history.dto';
import { Feargreed, FeargreedHistory } from './feargreed.interface';
import { FeargreedService } from './feargreed.service';

@Controller('api/v1/feargreeds')
export class FeargreedController {
  constructor(private readonly feargreedService: FeargreedService) {}

  @Get()
  async get(): Promise<Feargreed> {
    return this.feargreedService.getFeargreed();
  }

  @Get('history')
  async getHistory(@Query() query: FeargreedHistoryDto): Promise<FeargreedHistory> {
    return this.feargreedService.getFeargreedHistory(query.limit || 30);
  }
}
