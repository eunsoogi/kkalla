import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { Sequence } from './entities/sequence.entity';

@Injectable()
export class SequenceService {
  constructor(
    @InjectRepository(Sequence)
    private readonly sequenceRepository: Repository<Sequence>,
  ) {}

  public async getNextSequence(): Promise<number> {
    const res = await this.sequenceRepository.insert({});
    const id = res.identifiers[0]?.value ?? res.generatedMaps[0]?.value ?? (res as any).raw?.insertId;
    return id as number;
  }

  public async getCurrentSequence(): Promise<number> {
    const lastSequence = await this.sequenceRepository.findOne({
      order: { value: 'DESC' },
    });

    return lastSequence ? lastSequence.value : 0;
  }
}
