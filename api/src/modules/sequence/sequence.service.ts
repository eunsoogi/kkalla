import { Injectable } from '@nestjs/common';

import { Sequence } from './entities/sequence.entity';

@Injectable()
export class SequenceService {
  private sequenceQueue: Promise<number> = Promise.resolve(0);

  public async getNextSequence(): Promise<number> {
    this.sequenceQueue = this.sequenceQueue.then(async () => {
      const sequence = new Sequence();
      const savedSequence = await sequence.save();
      return savedSequence.value;
    });

    return this.sequenceQueue;
  }

  public async getCurrentSequence(): Promise<number> {
    const sequences = await Sequence.find({
      order: { value: 'DESC' },
      take: 1,
    });

    return sequences.length > 0 ? sequences[0].value : 0;
  }
}
