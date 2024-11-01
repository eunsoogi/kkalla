import { Controller, Get } from '@nestjs/common';

import { Feargreed } from './feargreed.interface';
import { FeargreedService } from './feargreed.service';

@Controller('api/v1/feargreeds')
export class FeargreedController {
  constructor(private readonly feargreedService: FeargreedService) {}

  @Get()
  async get(): Promise<Feargreed> {
    return this.feargreedService.get();
  }
}
