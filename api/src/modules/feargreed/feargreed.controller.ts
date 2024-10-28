import { Controller, Get } from '@nestjs/common';

import { Feargreed } from './feargreed.interface';
import { FeargreedService } from './feargreed.service';

@Controller('api/v1/feargreed')
export class FeargreedController {
  constructor(private readonly feargreedService: FeargreedService) {}

  @Get()
  async getNews(): Promise<Feargreed> {
    return this.feargreedService.getFeargreed();
  }
}
