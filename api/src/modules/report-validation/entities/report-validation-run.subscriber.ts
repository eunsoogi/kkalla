import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { ReportValidationRun } from './report-validation-run.entity';

@EventSubscriber()
export class ReportValidationRunSubscriber implements EntitySubscriberInterface<ReportValidationRun> {
  public listenTo() {
    return ReportValidationRun;
  }

  public async beforeInsert(event: InsertEvent<ReportValidationRun>) {
    if (event.entity.seq == null) {
      const res = await event.manager.insert(Sequence, {});
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
