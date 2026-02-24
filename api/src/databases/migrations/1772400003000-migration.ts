import { MigrationInterface, QueryRunner } from 'typeorm';

import { normalizeIdentifierToUlid } from '../../utils/id';

interface SwapColumnPlan {
  table: string;
  oldColumn: string;
  newColumn: string;
  nullable: boolean;
}

export class Migration1772400003000 implements MigrationInterface {
  private static readonly BACKFILL_BATCH_SIZE = 1000;

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
    const cutoverCompleted = await this.isCutoverCompleted(queryRunner);
    if (cutoverCompleted) {
      return;
    }

    await this.backfillRelationUlidsAndAuditBatchIds(queryRunner);
    await this.runPreflightChecks(queryRunner);
  }

  public async down(): Promise<void> {
    throw new Error('Migration1772400003000 down migration is not supported');
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
    await queryRunner.query(`
      UPDATE trade t
      INNER JOIN user u ON u.id = t.user_id
      SET t.user_id_ulid = u.id_ulid
      WHERE t.user_id_ulid IS NULL
    `);

    await queryRunner.query(`
      UPDATE trade t
      INNER JOIN allocation_recommendation a ON a.id = t.inference_id
      SET t.inference_id_ulid = a.id_ulid
      WHERE t.inference_id IS NOT NULL
        AND t.inference_id_ulid IS NULL
    `);

    await queryRunner.query(`
      UPDATE notify n
      INNER JOIN user u ON u.id = n.user_id
      SET n.user_id_ulid = u.id_ulid
      WHERE n.user_id_ulid IS NULL
    `);

    await queryRunner.query(`
      UPDATE schedule s
      INNER JOIN user u ON u.id = s.user_id
      SET s.user_id_ulid = u.id_ulid
      WHERE s.user_id_ulid IS NULL
    `);

    await queryRunner.query(`
      UPDATE upbit_config uc
      INNER JOIN user u ON u.id = uc.user_id
      SET uc.user_id_ulid = u.id_ulid
      WHERE uc.user_id_ulid IS NULL
    `);

    await queryRunner.query(`
      UPDATE slack_config sc
      INNER JOIN user u ON u.id = sc.user_id
      SET sc.user_id_ulid = u.id_ulid
      WHERE sc.user_id_ulid IS NULL
    `);

    await queryRunner.query(`
      UPDATE holding_ledger h
      INNER JOIN user u ON u.id = h.user_id
      SET h.user_id_ulid = u.id_ulid
      WHERE h.user_id_ulid IS NULL
    `);

    await queryRunner.query(`
      UPDATE user_category uc
      INNER JOIN user u ON u.id = uc.user_id
      SET uc.user_id_ulid = u.id_ulid
      WHERE uc.user_id_ulid IS NULL
    `);

    await queryRunner.query(`
      UPDATE allocation_audit_item i
      INNER JOIN allocation_audit_run r ON r.id = i.run_id
      SET i.run_id_ulid = r.id_ulid
      WHERE i.run_id_ulid IS NULL
    `);

    await queryRunner.query(`
      UPDATE allocation_audit_item i
      INNER JOIN allocation_recommendation a ON a.id = i.source_recommendation_id
      SET i.source_recommendation_id_ulid = a.id_ulid
      WHERE i.report_type = 'allocation'
        AND i.source_recommendation_id_ulid IS NULL
    `);

    await queryRunner.query(`
      UPDATE allocation_audit_item i
      INNER JOIN market_signal m ON m.id = i.source_recommendation_id
      SET i.source_recommendation_id_ulid = m.id_ulid
      WHERE i.report_type = 'market'
        AND i.source_recommendation_id_ulid IS NULL
    `);

    await queryRunner.query(`
      UPDATE user_roles_role urr
      INNER JOIN user u ON u.id = urr.user_id
      SET urr.user_id_ulid = u.id_ulid
      WHERE urr.user_id_ulid IS NULL
    `);

    await queryRunner.query(`
      UPDATE user_roles_role urr
      INNER JOIN role r ON r.id = urr.role_id
      SET urr.role_id_ulid = r.id_ulid
      WHERE urr.role_id_ulid IS NULL
    `);

    await this.backfillTradeExecutionLedgerUserUlids(queryRunner);
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

      await queryRunner.query(
        `UPDATE trade_execution_ledger SET user_id_ulid = CASE user_id ${caseFragments} END WHERE user_id IN (${inPlaceholders}) AND user_id_ulid IS NULL`,
        params,
      );
    }
  }

  private async migrateAllocationAuditBatchIds(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE allocation_audit_run r
      INNER JOIN allocation_recommendation a ON CAST(a.batch_id AS CHAR(36)) = CAST(r.source_batch_id AS CHAR(36))
      SET r.source_batch_id = a.batch_id_ulid
      WHERE r.report_type = 'allocation'
        AND CHAR_LENGTH(r.source_batch_id) <> 26
    `);

    await queryRunner.query(`
      UPDATE allocation_audit_item i
      INNER JOIN allocation_recommendation a ON CAST(a.batch_id AS CHAR(36)) = CAST(i.source_batch_id AS CHAR(36))
      SET i.source_batch_id = a.batch_id_ulid
      WHERE i.report_type = 'allocation'
        AND CHAR_LENGTH(i.source_batch_id) <> 26
    `);
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

    await queryRunner.query(`
      ALTER TABLE \`${tableName}\`
      CHANGE COLUMN \`source_batch_id\` \`source_batch_id\` VARCHAR(255) NOT NULL
    `);
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
}
