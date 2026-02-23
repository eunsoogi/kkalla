import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

import { Sequence } from '@/modules/sequence/entities/sequence.entity';

import { MarketSignal } from './market-signal.entity';

@EventSubscriber()
export class MarketSignalSubscriber implements EntitySubscriberInterface<MarketSignal> {
  /**
   * Retrieves listen to for the market signal flow.
   * @returns Result produced by the market signal flow.
   */
  public listenTo() {
    return MarketSignal;
  }

  /**
   * Handles before insert in the market signal workflow.
   * @param event - Input value for event.
   * @returns Result produced by the market signal flow.
   */
  public async beforeInsert(event: InsertEvent<MarketSignal>) {
    if (event.entity.seq == null) {
      const res = await event.manager.insert(Sequence, {});
      const id = res.identifiers?.[0]?.value ?? res.raw?.insertId ?? res.raw?.lastID;
      event.entity.seq = id;
    }
  }
}
