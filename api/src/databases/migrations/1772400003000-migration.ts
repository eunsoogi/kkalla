import { MigrationInterface, QueryRunner } from 'typeorm';

import { normalizeIdentifierToUlid } from '../../utils/id';

interface SwapColumnPlan {
  table: string;
  oldColumn: string;
  newColumn: string;
  nullable: boolean;
}

export class Migration1772400003000 implements MigrationInterface {
  public readonly transaction = false;

  private static readonly BACKFILL_BATCH_SIZE = 200;
  private static readonly MIGRATION_LOCK_NAME = 'migration:1772400001000-4000:ulid-cutover';
  private static readonly MIGRATION_LOCK_TIMEOUT_SECONDS = 3600;
  private static readonly LOCK_RETRY_MAX_ATTEMPTS = 10;
  private static readonly LOCK_RETRY_BASE_DELAY_MS = 300;

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

  private readonly swapColumnPlans: SwapColumnPlan[] = [
    { table: 'trade', oldColumn: 'user_id', newColumn: 'user_id_ulid', nullable: false },
    { table: 'trade', oldColumn: 'inference_id', newColumn: 'inference_id_ulid', nullable: true },
    { table: 'notify', oldColumn: 'user_id', newColumn: 'user_id_ulid', nullable: false },
    { table: 'schedule', oldColumn: 'user_id', newColumn: 'user_id_ulid', nullable: false },
    { table: 'upbit_config', oldColumn: 'user_id', newColumn: 'user_id_ulid', nullable: false },
    { table: 'slack_config', oldColumn: 'user_id', newColumn: 'user_id_ulid', nullable: false },
    { table: 'holding_ledger', oldColumn: 'user_id', newColumn: 'user_id_ulid', nullable: false },
    { table: 'user_category', oldColumn: 'user_id', newColumn: 'user_id_ulid', nullable: false },
    { table: 'allocation_audit_item', oldColumn: 'run_id', newColumn: 'run_id_ulid', nullable: false },
    {
      table: 'allocation_audit_item',
      oldColumn: 'source_recommendation_id',
      newColumn: 'source_recommendation_id_ulid',
      nullable: false,
    },
    { table: 'trade_execution_ledger', oldColumn: 'user_id', newColumn: 'user_id_ulid', nullable: false },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.withMigrationLock(queryRunner, async () => {
      const cutoverCompleted = await this.isCutoverCompleted(queryRunner);
      if (cutoverCompleted) {
        return;
      }

      await this.backfillRelationUlidsAndAuditBatchIds(queryRunner);
      await this.runPreflightChecks(queryRunner);
    });
  }

  public async down(): Promise<void> {
    throw new Error('Migration1772400003000 down migration is not supported');
  }

  private async withMigrationLock(queryRunner: QueryRunner, callback: () => Promise<void>): Promise<void> {
    const rows: Array<{ acquired: string | number | null }> = await queryRunner.query(
      'SELECT GET_LOCK(?, ?) AS acquired',
      [Migration1772400003000.MIGRATION_LOCK_NAME, Migration1772400003000.MIGRATION_LOCK_TIMEOUT_SECONDS],
    );

    if (Number(rows[0]?.acquired ?? 0) !== 1) {
      throw new Error('[ulid cutover] failed to acquire migration lock for Migration1772400003000');
    }

    try {
      await callback();
    } finally {
      try {
        await queryRunner.query('SELECT RELEASE_LOCK(?)', [Migration1772400003000.MIGRATION_LOCK_NAME]);
      } catch {
        // noop
      }
    }
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

  private async backfillRelationUlidsAndAuditBatchIds(queryRunner: QueryRunner): Promise<void> {
    await this.backfillRelationUlids(queryRunner);
    await this.ensureAuditSourceBatchIdColumnsAreVarchar(queryRunner);
    await this.migrateAllocationAuditBatchIds(queryRunner);
    await this.assertAllocationAuditBatchIdsMigrated(queryRunner, 'allocation_audit_run');
    await this.assertAllocationAuditBatchIdsMigrated(queryRunner, 'allocation_audit_item');
  }

  private async backfillRelationUlids(queryRunner: QueryRunner): Promise<void> {
    await this.backfillTradeUserUlids(queryRunner);

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT t.id AS id, a.id_ulid AS value
        FROM trade t
        INNER JOIN allocation_recommendation a ON a.id = t.inference_id
        WHERE t.inference_id IS NOT NULL
          AND t.inference_id_ulid IS NULL
          AND a.id_ulid IS NOT NULL
        ORDER BY t.id ASC
      `,
      'trade',
      'id',
      'inference_id_ulid',
    );

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT n.id AS id, u.id_ulid AS value
        FROM notify n
        INNER JOIN user u ON u.id = n.user_id
        WHERE n.user_id_ulid IS NULL
          AND u.id_ulid IS NOT NULL
        ORDER BY n.id ASC
      `,
      'notify',
      'id',
      'user_id_ulid',
    );

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT s.id AS id, u.id_ulid AS value
        FROM schedule s
        INNER JOIN user u ON u.id = s.user_id
        WHERE s.user_id_ulid IS NULL
          AND u.id_ulid IS NOT NULL
        ORDER BY s.id ASC
      `,
      'schedule',
      'id',
      'user_id_ulid',
    );

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT uc.id AS id, u.id_ulid AS value
        FROM upbit_config uc
        INNER JOIN user u ON u.id = uc.user_id
        WHERE uc.user_id_ulid IS NULL
          AND u.id_ulid IS NOT NULL
        ORDER BY uc.id ASC
      `,
      'upbit_config',
      'id',
      'user_id_ulid',
    );

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT sc.id AS id, u.id_ulid AS value
        FROM slack_config sc
        INNER JOIN user u ON u.id = sc.user_id
        WHERE sc.user_id_ulid IS NULL
          AND u.id_ulid IS NOT NULL
        ORDER BY sc.id ASC
      `,
      'slack_config',
      'id',
      'user_id_ulid',
    );

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT h.id AS id, u.id_ulid AS value
        FROM holding_ledger h
        INNER JOIN user u ON u.id = h.user_id
        WHERE h.user_id_ulid IS NULL
          AND u.id_ulid IS NOT NULL
        ORDER BY h.id ASC
      `,
      'holding_ledger',
      'id',
      'user_id_ulid',
    );

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT uc.id AS id, u.id_ulid AS value
        FROM user_category uc
        INNER JOIN user u ON u.id = uc.user_id
        WHERE uc.user_id_ulid IS NULL
          AND u.id_ulid IS NOT NULL
        ORDER BY uc.id ASC
      `,
      'user_category',
      'id',
      'user_id_ulid',
    );

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT i.id AS id, r.id_ulid AS value
        FROM allocation_audit_item i
        INNER JOIN allocation_audit_run r ON r.id = i.run_id
        WHERE i.run_id_ulid IS NULL
          AND r.id_ulid IS NOT NULL
        ORDER BY i.id ASC
      `,
      'allocation_audit_item',
      'id',
      'run_id_ulid',
    );

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT i.id AS id, a.id_ulid AS value
        FROM allocation_audit_item i
        INNER JOIN allocation_recommendation a ON a.id = i.source_recommendation_id
        WHERE i.report_type = 'allocation'
          AND i.source_recommendation_id_ulid IS NULL
          AND a.id_ulid IS NOT NULL
        ORDER BY i.id ASC
      `,
      'allocation_audit_item',
      'id',
      'source_recommendation_id_ulid',
    );

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT i.id AS id, m.id_ulid AS value
        FROM allocation_audit_item i
        INNER JOIN market_signal m ON m.id = i.source_recommendation_id
        WHERE i.report_type = 'market'
          AND i.source_recommendation_id_ulid IS NULL
          AND m.id_ulid IS NOT NULL
        ORDER BY i.id ASC
      `,
      'allocation_audit_item',
      'id',
      'source_recommendation_id_ulid',
    );

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT urr.user_id AS id, u.id_ulid AS value
        FROM user_roles_role urr
        INNER JOIN user u ON u.id = urr.user_id
        WHERE urr.user_id_ulid IS NULL
          AND u.id_ulid IS NOT NULL
        ORDER BY urr.user_id ASC
      `,
      'user_roles_role',
      'user_id',
      'user_id_ulid',
    );

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT urr.role_id AS id, r.id_ulid AS value
        FROM user_roles_role urr
        INNER JOIN role r ON r.id = urr.role_id
        WHERE urr.role_id_ulid IS NULL
          AND r.id_ulid IS NOT NULL
        ORDER BY urr.role_id ASC
      `,
      'user_roles_role',
      'role_id',
      'role_id_ulid',
    );

    await this.backfillTradeExecutionLedgerUserUlids(queryRunner);
  }

  private async backfillTradeUserUlids(queryRunner: QueryRunner): Promise<void> {
    while (true) {
      const rows: Array<{ id: string; user_id_ulid: string }> = await queryRunner.query(`
        SELECT t.id, u.id_ulid AS user_id_ulid
        FROM trade t
        INNER JOIN user u ON u.id = t.user_id
        WHERE t.user_id_ulid IS NULL
          AND u.id_ulid IS NOT NULL
        ORDER BY t.id ASC
        LIMIT ${Migration1772400003000.BACKFILL_BATCH_SIZE}
      `);

      if (rows.length === 0) {
        break;
      }

      const caseFragments = rows.map(() => 'WHEN ? THEN ?').join(' ');
      const idPlaceholders = rows.map(() => '?').join(', ');
      const params = rows.flatMap((row) => [row.id, row.user_id_ulid]);
      params.push(...rows.map((row) => row.id));

      await this.executeWithLockRetry(
        () =>
          queryRunner.query(
            `UPDATE trade SET user_id_ulid = CASE id ${caseFragments} END WHERE id IN (${idPlaceholders}) AND user_id_ulid IS NULL`,
            params,
          ),
        'trade.user_id_ulid backfill',
      );
    }
  }

  private async backfillByJoin(
    queryRunner: QueryRunner,
    selectQuery: string,
    tableName: string,
    idColumn: string,
    valueColumn: string,
    updateConditionSql = `\`${valueColumn}\` IS NULL`,
  ): Promise<void> {
    while (true) {
      const rows: Array<{ id: string; value: string }> = await queryRunner.query(`
        ${selectQuery}
        LIMIT ${Migration1772400003000.BACKFILL_BATCH_SIZE}
      `);

      if (rows.length === 0) {
        break;
      }

      const caseFragments = rows.map(() => 'WHEN ? THEN ?').join(' ');
      const inPlaceholders = rows.map(() => '?').join(', ');
      const params = rows.flatMap((row) => [row.id, row.value]);
      params.push(...rows.map((row) => row.id));

      await this.executeWithLockRetry(
        () =>
          queryRunner.query(
            `UPDATE \`${tableName}\` SET \`${valueColumn}\` = CASE \`${idColumn}\` ${caseFragments} END WHERE \`${idColumn}\` IN (${inPlaceholders}) AND ${updateConditionSql}`,
            params,
          ),
        `${tableName}.${valueColumn} backfill`,
      );
    }
  }

  private async backfillTradeExecutionLedgerUserUlids(queryRunner: QueryRunner): Promise<void> {
    const hasUserIdUlid = await queryRunner.hasColumn('trade_execution_ledger', 'user_id_ulid');
    if (!hasUserIdUlid) {
      return;
    }

    while (true) {
      const rows: Array<{ user_id: string }> = await queryRunner.query(`
        SELECT user_id
        FROM trade_execution_ledger
        WHERE user_id_ulid IS NULL
        GROUP BY user_id
        ORDER BY user_id ASC
        LIMIT ${Migration1772400003000.BACKFILL_BATCH_SIZE}
      `);

      if (rows.length === 0) {
        break;
      }

      const updates = rows.map((row) => ({
        userId: row.user_id,
        userIdUlid: normalizeIdentifierToUlid(row.user_id),
      }));

      const caseFragments = updates.map(() => 'WHEN ? THEN ?').join(' ');
      const inPlaceholders = updates.map(() => '?').join(', ');
      const params = updates.flatMap((update) => [update.userId, update.userIdUlid]);
      params.push(...updates.map((update) => update.userId));

      await this.executeWithLockRetry(
        () =>
          queryRunner.query(
            `UPDATE trade_execution_ledger SET user_id_ulid = CASE user_id ${caseFragments} END WHERE user_id IN (${inPlaceholders}) AND user_id_ulid IS NULL`,
            params,
          ),
        'trade_execution_ledger.user_id_ulid backfill',
      );
    }
  }

  private async migrateAllocationAuditBatchIds(queryRunner: QueryRunner): Promise<void> {
    await this.backfillByJoin(
      queryRunner,
      `
        SELECT r.id AS id, MIN(a.batch_id_ulid) AS value
        FROM allocation_audit_run r
        INNER JOIN allocation_recommendation a
          ON CAST(a.batch_id AS CHAR(36)) = CAST(r.source_batch_id AS CHAR(36))
        WHERE r.report_type = 'allocation'
          AND CHAR_LENGTH(r.source_batch_id) <> 26
          AND a.batch_id_ulid IS NOT NULL
        GROUP BY r.id
        ORDER BY r.id ASC
      `,
      'allocation_audit_run',
      'id',
      'source_batch_id',
      'CHAR_LENGTH(`source_batch_id`) <> 26',
    );

    await this.backfillByJoin(
      queryRunner,
      `
        SELECT i.id AS id, MIN(a.batch_id_ulid) AS value
        FROM allocation_audit_item i
        INNER JOIN allocation_recommendation a
          ON CAST(a.batch_id AS CHAR(36)) = CAST(i.source_batch_id AS CHAR(36))
        WHERE i.report_type = 'allocation'
          AND CHAR_LENGTH(i.source_batch_id) <> 26
          AND a.batch_id_ulid IS NOT NULL
        GROUP BY i.id
        ORDER BY i.id ASC
      `,
      'allocation_audit_item',
      'id',
      'source_batch_id',
      'CHAR_LENGTH(`source_batch_id`) <> 26',
    );
  }

  private async ensureAuditSourceBatchIdColumnsAreVarchar(queryRunner: QueryRunner): Promise<void> {
    await this.ensureSourceBatchIdColumnIsVarchar(queryRunner, 'allocation_audit_run');
    await this.ensureSourceBatchIdColumnIsVarchar(queryRunner, 'allocation_audit_item');
  }

  private async ensureSourceBatchIdColumnIsVarchar(queryRunner: QueryRunner, tableName: string): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }

    const sourceBatchIdColumn = table.findColumnByName('source_batch_id');
    if (!sourceBatchIdColumn) {
      return;
    }

    const columnType = sourceBatchIdColumn.type.toLowerCase();
    const isTextType = columnType === 'varchar' || columnType === 'char' || columnType.includes('text');
    if (isTextType) {
      return;
    }

    await this.executeWithLockRetry(
      () =>
        queryRunner.query(`
          ALTER TABLE \`${tableName}\`
          CHANGE COLUMN \`source_batch_id\` \`source_batch_id\` VARCHAR(255) NOT NULL
        `),
      `${tableName}.source_batch_id type change`,
    );
  }

  private async assertAllocationAuditBatchIdsMigrated(queryRunner: QueryRunner, tableName: string): Promise<void> {
    const rows: Array<{ count: string | number }> = await queryRunner.query(
      `SELECT COUNT(*) AS count
       FROM \`${tableName}\`
       WHERE report_type = 'allocation'
         AND (source_batch_id IS NULL OR CHAR_LENGTH(source_batch_id) <> 26)`,
    );

    if (Number(rows[0]?.count ?? 0) > 0) {
      throw new Error(`[ulid cutover] ${tableName}.source_batch_id still has non-ULID values for allocation rows`);
    }
  }

  private async runPreflightChecks(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.idTables) {
      const hasStagingColumn = await queryRunner.hasColumn(table, 'id_ulid');
      if (!hasStagingColumn) {
        continue;
      }

      await this.assertNoNull(queryRunner, table, 'id_ulid');
      await this.assertNoDuplicates(queryRunner, table, 'id_ulid');
    }

    await this.assertNoNullWhenOldNotNull(queryRunner, 'allocation_recommendation', 'batch_id', 'batch_id_ulid');
    await this.assertNoNullWhenOldNotNull(queryRunner, 'user', 'id', 'legacy_id');

    const hasUserLegacyId = await queryRunner.hasColumn('user', 'legacy_id');
    if (hasUserLegacyId) {
      await this.assertNoDuplicates(queryRunner, 'user', 'legacy_id');
    }

    for (const plan of this.swapColumnPlans) {
      await this.assertNoNullWhenOldNotNull(queryRunner, plan.table, plan.oldColumn, plan.newColumn);
    }

    await this.assertNoNullWhenOldNotNull(queryRunner, 'user_roles_role', 'user_id', 'user_id_ulid');
    await this.assertNoNullWhenOldNotNull(queryRunner, 'user_roles_role', 'role_id', 'role_id_ulid');
  }

  private async assertNoNull(queryRunner: QueryRunner, tableName: string, columnName: string): Promise<void> {
    const rows: Array<{ count: string | number }> = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM \`${tableName}\` WHERE \`${columnName}\` IS NULL`,
    );

    if (Number(rows[0]?.count ?? 0) > 0) {
      throw new Error(`[ulid cutover] ${tableName}.${columnName} contains NULL values`);
    }
  }

  private async assertNoDuplicates(queryRunner: QueryRunner, tableName: string, columnName: string): Promise<void> {
    const rows: Array<{ total: string | number; unique_count: string | number }> = await queryRunner.query(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT \`${columnName}\`) AS unique_count FROM \`${tableName}\``,
    );

    if (Number(rows[0]?.total ?? 0) !== Number(rows[0]?.unique_count ?? 0)) {
      throw new Error(`[ulid cutover] ${tableName}.${columnName} contains duplicate values`);
    }
  }

  private async assertNoNullWhenOldNotNull(
    queryRunner: QueryRunner,
    tableName: string,
    oldColumn: string,
    newColumn: string,
  ): Promise<void> {
    const hasOldColumn = await queryRunner.hasColumn(tableName, oldColumn);
    const hasNewColumn = await queryRunner.hasColumn(tableName, newColumn);
    if (!hasOldColumn || !hasNewColumn) {
      return;
    }

    const rows: Array<{ count: string | number }> = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM \`${tableName}\` WHERE \`${oldColumn}\` IS NOT NULL AND \`${newColumn}\` IS NULL`,
    );

    if (Number(rows[0]?.count ?? 0) > 0) {
      throw new Error(`[ulid cutover] ${tableName}.${newColumn} is NULL while ${oldColumn} is NOT NULL`);
    }
  }

  private async executeWithLockRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        attempt += 1;
        if (!this.isRetryableLockError(error)) {
          throw error;
        }

        if (attempt >= Migration1772400003000.LOCK_RETRY_MAX_ATTEMPTS) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(`[ulid cutover] ${operationName} failed after ${attempt} attempts: ${reason}`);
        }

        const delayMs = Migration1772400003000.LOCK_RETRY_BASE_DELAY_MS * attempt;
        await this.sleep(delayMs);
      }
    }
  }

  private isRetryableLockError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    return message.includes('lock wait timeout exceeded') || message.includes('deadlock found');
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
