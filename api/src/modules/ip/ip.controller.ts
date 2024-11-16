import { Controller, Get } from '@nestjs/common';

import { IpService } from './ip.service';

@Controller('api/v1/ip')
export class IpController {
  constructor(private readonly ipService: IpService) {}

  @Get()
  public async get(): Promise<string> {
    return this.ipService.getPublicIp();
  }
}
