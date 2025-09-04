import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { BalanceRecommendation } from './balance-recommendation.entity';

@EventSubscriber()
export class BalanceRecommendationSubscriber implements EntitySubscriberInterface<BalanceRecommendation> {
  listenTo() {
    return BalanceRecommendation;
  }

  async beforeInsert(event: InsertEvent<BalanceRecommendation>) {
    if (event.entity.seq == null) {
      const res = await event.manager.createQueryBuilder().insert().into(Sequence).values({}).execute();
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
