import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { AllocationRecommendation } from './allocation-recommendation.entity';

@EventSubscriber()
export class AllocationRecommendationSubscriber implements EntitySubscriberInterface<AllocationRecommendation> {
  /**
   * Retrieves listen to for the allocation recommendation flow.
   * @returns Result produced by the allocation recommendation flow.
   */
  public listenTo() {
    return AllocationRecommendation;
  }

  /**
   * Handles before insert in the allocation recommendation workflow.
   * @param event - Input value for event.
   * @returns Result produced by the allocation recommendation flow.
   */
  public async beforeInsert(event: InsertEvent<AllocationRecommendation>) {
    if (event.entity.seq == null) {
      const res = await event.manager.insert(Sequence, {});
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
