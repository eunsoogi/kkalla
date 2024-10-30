import { Controller, Get } from '@nestjs/common';

import { FeargreedService } from './feargreed.service';
import { Feargreed } from './feargreed.type';

@Controller('api/v1/feargreeds')
export class FeargreedController {
  constructor(private readonly feargreedService: FeargreedService) {}

  @Get()
  async getNews(): Promise<Feargreed> {
    return this.feargreedService.getFeargreed();
  }
}
