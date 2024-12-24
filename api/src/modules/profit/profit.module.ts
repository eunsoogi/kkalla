import { Module } from '@nestjs/common';

import { ProfitController } from './profit.controller';
import { ProfitService } from './profit.service';

@Module({
  controllers: [ProfitController],
  providers: [ProfitService],
})
export class ProfitModule {}
