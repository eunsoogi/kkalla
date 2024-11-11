import { Controller, Get } from '@nestjs/common';

import { FirechartService } from './firechart.service';

@Controller('api/v1/firechart')
export class FirechartController {
  constructor(private readonly firechartService: FirechartService) {}

  @Get()
  public async get(): Promise<string> {
    return this.firechartService.getFirechart();
  }
}
