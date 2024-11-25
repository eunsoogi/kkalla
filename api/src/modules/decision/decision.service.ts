import { Injectable } from '@nestjs/common';

import { CursorItem, CursorRequest, ItemRequest, PaginatedItem } from '../item/item.interface';
import { SequenceService } from '../sequence/sequence.service';
import { DecisionData, DecisionFilter } from './decision.interface';
import { Decision } from './entities/decision.entity';

@Injectable()
export class DecisionService {
  constructor(private readonly sequenceService: SequenceService) {}

  async create(data: DecisionData): Promise<Decision> {
    const decision = new Decision();

    Object.assign(decision, data);
    decision.seq = await this.sequenceService.getNextSequence();

    return decision.save();
  }

  async paginate(request: ItemRequest & DecisionFilter): Promise<PaginatedItem<Decision>> {
    return Decision.paginate(request);
  }

  async cursor(request: CursorRequest<string> & DecisionFilter): Promise<CursorItem<Decision, string>> {
    return Decision.cursor(request);
  }

  async findOne(id: string): Promise<Decision> {
    return Decision.findOne({
      where: { id },
      relations: ['users', 'inference'],
    });
  }
}
