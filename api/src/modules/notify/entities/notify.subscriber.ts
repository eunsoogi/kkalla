import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { Notify } from './notify.entity';

@EventSubscriber()
export class NotifySubscriber implements EntitySubscriberInterface<Notify> {
  listenTo() {
    return Notify;
  }

  async beforeInsert(event: InsertEvent<Notify>) {
    if (event.entity.seq == null) {
      const res = await event.manager.createQueryBuilder().insert().into(Sequence).values({}).execute();
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
