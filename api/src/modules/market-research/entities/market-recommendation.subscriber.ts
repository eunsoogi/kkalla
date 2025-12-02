import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { MarketRecommendation } from './market-recommendation.entity';

@EventSubscriber()
export class MarketRecommendationSubscriber implements EntitySubscriberInterface<MarketRecommendation> {
  public listenTo() {
    return MarketRecommendation;
  }

  public async beforeInsert(event: InsertEvent<MarketRecommendation>) {
    if (event.entity.seq == null) {
      const res = await event.manager.insert(Sequence, {});
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
