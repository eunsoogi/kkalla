import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { AllocationAuditRun } from './allocation-audit-run.entity';

@EventSubscriber()
export class AllocationAuditRunSubscriber implements EntitySubscriberInterface<AllocationAuditRun> {
  public listenTo() {
    return AllocationAuditRun;
  }

  public async beforeInsert(event: InsertEvent<AllocationAuditRun>) {
    if (event.entity.seq == null) {
      const res = await event.manager.insert(Sequence, {});
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
