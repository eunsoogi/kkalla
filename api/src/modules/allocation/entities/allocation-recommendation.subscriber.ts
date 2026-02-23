import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { AllocationRecommendation } from './allocation-recommendation.entity';

@EventSubscriber()
export class AllocationRecommendationSubscriber implements EntitySubscriberInterface<AllocationRecommendation> {
  public listenTo() {
    return AllocationRecommendation;
  }

  public async beforeInsert(event: InsertEvent<AllocationRecommendation>) {
    if (event.entity.seq == null) {
      const res = await event.manager.insert(Sequence, {});
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
