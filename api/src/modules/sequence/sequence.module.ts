import { Module } from '@nestjs/common';

import { SequenceService } from './sequence.service';

@Module({
  providers: [SequenceService],
  exports: [SequenceService],
})
export class SequenceModule {}
