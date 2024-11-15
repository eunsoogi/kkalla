import { Injectable } from '@nestjs/common';

import { Sequence } from './entities/sequence.entity';

@Injectable()
export class SequenceService {
  async getNextSequence(): Promise<number> {
    const sequence = new Sequence();
    const savedSequence = await sequence.save();

    return savedSequence.value;
  }

  async getCurrentvalueuence(): Promise<number> {
    const lastSequence = await Sequence.findOne({
      order: { value: 'DESC' },
    });

    return lastSequence ? lastSequence.value : 0;
  }
}
