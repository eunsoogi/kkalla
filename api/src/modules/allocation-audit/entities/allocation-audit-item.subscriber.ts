import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { AllocationAuditItem } from './allocation-audit-item.entity';

@EventSubscriber()
export class AllocationAuditItemSubscriber implements EntitySubscriberInterface<AllocationAuditItem> {
  /**
   * Retrieves listen to for the allocation audit flow.
   * @returns Result produced by the allocation audit flow.
   */
  public listenTo() {
    return AllocationAuditItem;
  }

  /**
   * Handles before insert in the allocation audit workflow.
   * @param event - Input value for event.
   * @returns Result produced by the allocation audit flow.
   */
  public async beforeInsert(event: InsertEvent<AllocationAuditItem>) {
    if (event.entity.seq == null) {
      const res = await event.manager.insert(Sequence, {});
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
