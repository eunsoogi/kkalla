import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { IpController } from './ip.controller';
import { IpService } from './ip.service';

@Module({
  imports: [HttpModule],
  controllers: [IpController],
  providers: [IpService],
})
export class IpModule {}
