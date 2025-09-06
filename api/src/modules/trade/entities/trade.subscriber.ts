import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { Trade } from './trade.entity';

@EventSubscriber()
export class TradeSubscriber implements EntitySubscriberInterface<Trade> {
  public listenTo() {
    return Trade;
  }

  public async beforeInsert(event: InsertEvent<Trade>) {
    if (event.entity.seq == null) {
      const res = await event.manager.insert(Sequence, {});
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
