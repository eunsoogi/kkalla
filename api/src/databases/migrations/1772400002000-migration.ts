import { MigrationInterface, QueryRunner } from 'typeorm';
import { monotonicFactory } from 'ulid';

import { normalizeIdentifierToUlid } from '../../utils/id';

export class Migration1772400002000 implements MigrationInterface {
  private static readonly BACKFILL_BATCH_SIZE = 1000;

  private readonly ulid = monotonicFactory();

  private readonly idTables = [
    'user',
    'role',
    'user_category',
    'blacklist',
    'schedule',
    'upbit_config',
    'slack_config',
    'holding_ledger',
    'notify',
    'trade',
    'allocation_recommendation',
    'market_signal',
    'allocation_audit_run',
    'allocation_audit_item',
    'trade_execution_ledger',
  ] as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cutoverCompleted = await this.isCutoverCompleted(queryRunner);
    if (cutoverCompleted) {
      return;
    }

    await this.backfillPrimaryUlids(queryRunner);
    await this.backfillUserLegacyIds(queryRunner);
    await this.backfillBatchUlids(queryRunner);
  }

  public async down(): Promise<void> {
    throw new Error('Migration1772400002000 down migration is not supported');
  }

  private async isCutoverCompleted(queryRunner: QueryRunner): Promise<boolean> {
    const userTable = await queryRunner.getTable('user');
    if (!userTable) {
      return false;
    }

    if (userTable.findColumnByName('id_ulid')) {
      return false;
    }

    const idColumn = userTable.findColumnByName('id');
    return idColumn?.type === 'char' && String(idColumn.length ?? '') === '26';
  }

  private async backfillPrimaryUlids(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.idTables) {
      const hasStagingColumn = await queryRunner.hasColumn(table, 'id_ulid');
      if (!hasStagingColumn) {
        continue;
      }

      const hasCreatedAt = await queryRunner.hasColumn(table, 'created_at');
      const selectCreatedAt = hasCreatedAt ? ', created_at' : '';
      const orderBy = hasCreatedAt ? 'created_at ASC, id ASC' : 'id ASC';

      while (true) {
        const rows: Array<{ id: string; created_at?: Date | string | null }> = await queryRunner.query(
          `SELECT id${selectCreatedAt} FROM \`${table}\` WHERE id_ulid IS NULL ORDER BY ${orderBy} LIMIT ${Migration1772400002000.BACKFILL_BATCH_SIZE}`,
        );

        if (rows.length === 0) {
          break;
        }

        const updates = rows.map((row) => {
          const createdAtMs = row.created_at ? new Date(row.created_at).getTime() : undefined;
          const timeMs = createdAtMs != null && Number.isFinite(createdAtMs) ? createdAtMs : undefined;
          const shouldReuseExistingId = row.id.length === 26;
          const nextId = shouldReuseExistingId ? normalizeIdentifierToUlid(row.id) : this.ulid(timeMs);

          return { id: row.id, idUlid: nextId };
        });

        const caseFragments = updates.map(() => 'WHEN ? THEN ?').join(' ');
        const inPlaceholders = updates.map(() => '?').join(', ');
        const params = updates.flatMap((update) => [update.id, update.idUlid]);
        params.push(...updates.map((update) => update.id));

        await queryRunner.query(
          `UPDATE \`${table}\` SET id_ulid = CASE id ${caseFragments} END WHERE id IN (${inPlaceholders}) AND id_ulid IS NULL`,
          params,
        );
      }
    }
  }

  private async backfillUserLegacyIds(queryRunner: QueryRunner): Promise<void> {
    const hasLegacyId = await queryRunner.hasColumn('user', 'legacy_id');
    if (!hasLegacyId) {
      return;
    }

    await queryRunner.query(`
      UPDATE user
      SET legacy_id = id
      WHERE id IS NOT NULL
        AND legacy_id IS NULL
    `);
  }

  private async backfillBatchUlids(queryRunner: QueryRunner): Promise<void> {
    const hasBatchIdUlid = await queryRunner.hasColumn('allocation_recommendation', 'batch_id_ulid');
    if (!hasBatchIdUlid) {
      return;
    }

    const hasCreatedAt = await queryRunner.hasColumn('allocation_recommendation', 'created_at');
    const createdAtSelect = hasCreatedAt ? 'MIN(created_at) AS created_at' : 'NULL AS created_at';
    const createdAtOrder = hasCreatedAt ? 'created_at ASC,' : '';

    while (true) {
      const batches: Array<{ batch_id: string; created_at: Date | string | null }> = await queryRunner.query(`
        SELECT batch_id, ${createdAtSelect}
        FROM allocation_recommendation
        WHERE batch_id_ulid IS NULL
        GROUP BY batch_id
        ORDER BY ${createdAtOrder} batch_id ASC
        LIMIT ${Migration1772400002000.BACKFILL_BATCH_SIZE}
      `);

      if (batches.length === 0) {
        break;
      }

      const updates = batches.map((batch) => {
        const createdAtMs = batch.created_at ? new Date(batch.created_at).getTime() : undefined;
        const timeMs = createdAtMs != null && Number.isFinite(createdAtMs) ? createdAtMs : undefined;
        const shouldReuseExistingBatchId = batch.batch_id.length === 26;
        const nextBatchId = shouldReuseExistingBatchId ? normalizeIdentifierToUlid(batch.batch_id) : this.ulid(timeMs);

        return { batchId: batch.batch_id, batchIdUlid: nextBatchId };
      });

      const caseFragments = updates.map(() => 'WHEN ? THEN ?').join(' ');
      const inPlaceholders = updates.map(() => '?').join(', ');
      const params = updates.flatMap((update) => [update.batchId, update.batchIdUlid]);
      params.push(...updates.map((update) => update.batchId));

      await queryRunner.query(
        `UPDATE allocation_recommendation SET batch_id_ulid = CASE batch_id ${caseFragments} END WHERE batch_id IN (${inPlaceholders}) AND batch_id_ulid IS NULL`,
        params,
      );
    }
  }
}
