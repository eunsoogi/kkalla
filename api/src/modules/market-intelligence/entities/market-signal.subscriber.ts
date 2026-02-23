import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { MarketSignal } from './market-signal.entity';

@EventSubscriber()
export class MarketSignalSubscriber implements EntitySubscriberInterface<MarketSignal> {
  public listenTo() {
    return MarketSignal;
  }

  public async beforeInsert(event: InsertEvent<MarketSignal>) {
    if (event.entity.seq == null) {
      const res = await event.manager.insert(Sequence, {});
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
