import { Module } from '@nestjs/common';

import { SequenceModule } from '../sequence/sequence.module';
import { DecisionController } from './decision.controller';
import { DecisionService } from './decision.service';

@Module({
  imports: [SequenceModule],
  controllers: [DecisionController],
  providers: [DecisionService],
  exports: [DecisionService],
})
export class DecisionModule {}
