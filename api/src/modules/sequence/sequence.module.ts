import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Sequence } from './entities/sequence.entity';
import { SequenceService } from './sequence.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sequence])],
  providers: [SequenceService],
  exports: [SequenceService],
})
export class SequenceModule {}
