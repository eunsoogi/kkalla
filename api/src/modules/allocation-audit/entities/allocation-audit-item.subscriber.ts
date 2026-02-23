import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { AllocationAuditItem } from './allocation-audit-item.entity';

@EventSubscriber()
export class AllocationAuditItemSubscriber implements EntitySubscriberInterface<AllocationAuditItem> {
  public listenTo() {
    return AllocationAuditItem;
  }

  public async beforeInsert(event: InsertEvent<AllocationAuditItem>) {
    if (event.entity.seq == null) {
      const res = await event.manager.insert(Sequence, {});
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
