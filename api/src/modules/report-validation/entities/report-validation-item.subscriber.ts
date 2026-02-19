import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { ReportValidationItem } from './report-validation-item.entity';

@EventSubscriber()
export class ReportValidationItemSubscriber implements EntitySubscriberInterface<ReportValidationItem> {
  public listenTo() {
    return ReportValidationItem;
  }

  public async beforeInsert(event: InsertEvent<ReportValidationItem>) {
    if (event.entity.seq == null) {
      const res = await event.manager.insert(Sequence, {});
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
