import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';
import { monotonicFactory } from 'ulid';

import { normalizeIdentifierToUlid } from '../../utils/id';

interface UlidLinkColumn {
  table: string;
  oldColumn: string;
  newColumn: string;
  nullable: boolean;
}

interface SwapColumnPlan {
  table: string;
  oldColumn: string;
  newColumn: string;
  nullable: boolean;
}

interface ForeignKeyCapturePlan {
  table: string;
  columns: string[];
}

export class Migration1772400001000 implements MigrationInterface {
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

  private readonly linkColumns: UlidLinkColumn[] = [
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
    { table: 'user_roles_role', oldColumn: 'user_id', newColumn: 'user_id_ulid', nullable: false },
    { table: 'user_roles_role', oldColumn: 'role_id', newColumn: 'role_id_ulid', nullable: false },
    { table: 'trade_execution_ledger', oldColumn: 'user_id', newColumn: 'user_id_ulid', nullable: false },
  ];

  private readonly fkCapturePlans: ForeignKeyCapturePlan[] = [
    { table: 'trade', columns: ['user_id', 'inference_id'] },
    { table: 'notify', columns: ['user_id'] },
    { table: 'schedule', columns: ['user_id'] },
    { table: 'upbit_config', columns: ['user_id'] },
    { table: 'slack_config', columns: ['user_id'] },
    { table: 'holding_ledger', columns: ['user_id'] },
    { table: 'user_category', columns: ['user_id'] },
    { table: 'allocation_audit_item', columns: ['run_id', 'source_recommendation_id'] },
    { table: 'user_roles_role', columns: ['user_id', 'role_id'] },
  ];

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
    for (const table of this.idTables) {
      await this.addUlidColumnIfMissing(queryRunner, table, 'id_ulid');
      await this.addUniqueIndexIfMissing(queryRunner, table, `ux_${table}_id_ulid`, ['id_ulid']);
    }

    await this.addUserLegacyIdColumnIfMissing(queryRunner);
    await this.addUniqueIndexIfMissing(queryRunner, 'user', 'ux_user_legacy_id', ['legacy_id']);

    await this.addUlidColumnIfMissing(queryRunner, 'allocation_recommendation', 'batch_id_ulid');

    for (const link of this.linkColumns) {
      await this.addUlidColumnIfMissing(queryRunner, link.table, link.newColumn);
    }

    await this.backfillPrimaryUlids(queryRunner);
    await this.backfillUserLegacyIds(queryRunner);
    await this.backfillRelationUlids(queryRunner);
    await this.backfillBatchUlids(queryRunner);
    await this.runPreflightChecks(queryRunner);

    const capturedForeignKeys = new Map<string, TableForeignKey[]>();

    for (const plan of this.fkCapturePlans) {
      capturedForeignKeys.set(plan.table, await this.captureAndDropForeignKeys(queryRunner, plan.table, plan.columns));
    }

    await this.dropIndexIfExists(
      queryRunner,
      'trade_execution_ledger',
      'idx_trade_execution_ledger_module_message_user',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'allocation_recommendation',
      'idx_allocation_recommendation_batch_id_symbol',
    );

    await queryRunner.query(`
      UPDATE allocation_audit_run r
      INNER JOIN allocation_recommendation a ON a.batch_id = r.source_batch_id
      SET r.source_batch_id = a.batch_id_ulid
      WHERE r.report_type = 'allocation'
    `);

    await queryRunner.query(`
      UPDATE allocation_audit_item i
      INNER JOIN allocation_recommendation a ON a.batch_id = i.source_batch_id
      SET i.source_batch_id = a.batch_id_ulid
      WHERE i.report_type = 'allocation'
    `);

    await this.assertAllocationAuditBatchIdsMigrated(queryRunner, 'allocation_audit_run');
    await this.assertAllocationAuditBatchIdsMigrated(queryRunner, 'allocation_audit_item');

    for (const table of this.idTables) {
      await this.dropIndexIfExists(queryRunner, table, `ux_${table}_id_ulid`);
      await this.swapPrimaryIdColumn(queryRunner, table);
    }

    await this.swapColumnToUlid(queryRunner, 'allocation_recommendation', 'batch_id', 'batch_id_ulid', false);

    for (const plan of this.swapColumnPlans) {
      await this.swapColumnToUlid(queryRunner, plan.table, plan.oldColumn, plan.newColumn, plan.nullable);
    }

    await this.swapUserRolesJoinColumns(queryRunner);

    await this.dropSeqColumn(queryRunner, 'allocation_recommendation');
    await this.dropSeqColumn(queryRunner, 'market_signal');
    await this.dropSeqColumn(queryRunner, 'trade');
    await this.dropSeqColumn(queryRunner, 'notify');
    await this.dropSeqColumn(queryRunner, 'allocation_audit_run');
    await this.dropSeqColumn(queryRunner, 'allocation_audit_item');

    await this.ensureIndex(
      queryRunner,
      'allocation_recommendation',
      'idx_allocation_recommendation_batch_id_symbol',
      ['batch_id', 'symbol'],
      true,
    );
    await this.ensureIndex(queryRunner, 'allocation_recommendation', 'idx_allocation_recommendation_category_id', [
      'category',
      'id',
    ]);
    await this.ensureIndex(
      queryRunner,
      'allocation_recommendation',
      'idx_allocation_recommendation_category_symbol_id',
      ['category', 'symbol', 'id'],
    );

    await this.ensureIndex(queryRunner, 'market_signal', 'idx_market_signal_symbol_id', ['symbol', 'id']);

    await this.ensureIndex(queryRunner, 'trade', 'idx_trade_user_id', ['user_id', 'id']);
    await this.ensureIndex(queryRunner, 'notify', 'idx_notify_user_id', ['user_id', 'id']);

    await this.ensureIndex(queryRunner, 'schedule', 'uq_schedule_user_id', ['user_id'], true);
    await this.ensureIndex(queryRunner, 'upbit_config', 'uq_upbit_config_user_id', ['user_id'], true);
    await this.ensureIndex(queryRunner, 'slack_config', 'uq_slack_config_user_id', ['user_id'], true);

    await this.ensureIndex(queryRunner, 'user_category', 'idx_user_category_user_enabled_category', [
      'user_id',
      'enabled',
      'category',
    ]);
    await this.ensureIndex(queryRunner, 'user_roles_role', 'idx_user_roles_role_user_id', ['user_id']);
    await this.ensureIndex(queryRunner, 'user_roles_role', 'idx_user_roles_role_role_id', ['role_id']);

    await this.ensureIndex(
      queryRunner,
      'allocation_audit_item',
      'idx_allocation_audit_item_source_recommendation_horizon',
      ['source_recommendation_id', 'horizon_hours'],
      true,
    );

    await this.ensureIndex(
      queryRunner,
      'trade_execution_ledger',
      'idx_trade_execution_ledger_module_message_user',
      ['module', 'message_key', 'user_id'],
      true,
    );

    for (const [table, foreignKeys] of capturedForeignKeys.entries()) {
      for (const foreignKey of foreignKeys) {
        await queryRunner.createForeignKey(table, foreignKey);
      }
    }

    const hasSequenceTable = await queryRunner.hasTable('sequence');
    if (hasSequenceTable) {
      await queryRunner.dropTable('sequence');
    }
  }

  public async down(): Promise<void> {
    throw new Error('Migration1772400001000 down migration is not supported');
  }

  private async addUlidColumnIfMissing(queryRunner: QueryRunner, tableName: string, columnName: string): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(tableName, columnName);
    if (hasColumn) {
      return;
    }

    await queryRunner.addColumn(
      tableName,
      new TableColumn({
        name: columnName,
        type: 'char',
        length: '26',
        charset: 'ascii',
        collation: 'ascii_bin',
        isNullable: true,
      }),
    );
  }

  private async addUserLegacyIdColumnIfMissing(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('user', 'legacy_id');
    if (hasColumn) {
      return;
    }

    await queryRunner.addColumn(
      'user',
      new TableColumn({
        name: 'legacy_id',
        type: 'char',
        length: '36',
        charset: 'ascii',
        collation: 'ascii_bin',
        isNullable: true,
      }),
    );
  }

  private async addUniqueIndexIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columnNames: string[],
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }

    const exists = table.indices.some((index) => index.name === indexName);
    if (exists) {
      return;
    }

    await queryRunner.createIndex(
      tableName,
      new TableIndex({
        name: indexName,
        columnNames,
        isUnique: true,
      }),
    );
  }

  private async backfillPrimaryUlids(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.idTables) {
      const rows: Array<{ id: string; created_at: Date | string | null }> = await queryRunner.query(
        `SELECT id, created_at FROM \`${table}\` WHERE id_ulid IS NULL ORDER BY created_at ASC, id ASC`,
      );

      for (const row of rows) {
        const createdAtMs = row.created_at ? new Date(row.created_at).getTime() : undefined;
        const timeMs = createdAtMs != null && Number.isFinite(createdAtMs) ? createdAtMs : undefined;
        await queryRunner.query(`UPDATE \`${table}\` SET id_ulid = ? WHERE id = ?`, [this.ulid(timeMs), row.id]);
      }
    }
  }

  private async backfillUserLegacyIds(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE user
      SET legacy_id = id
      WHERE id IS NOT NULL
        AND legacy_id IS NULL
    `);
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
    const rows: Array<{ user_id: string; created_at: Date | string | null }> = await queryRunner.query(`
      SELECT user_id, MIN(created_at) AS created_at
      FROM trade_execution_ledger
      WHERE user_id_ulid IS NULL
      GROUP BY user_id
      ORDER BY created_at ASC, user_id ASC
    `);

    for (const row of rows) {
      const normalizedUserId = normalizeIdentifierToUlid(row.user_id);
      await queryRunner.query(
        `UPDATE trade_execution_ledger SET user_id_ulid = ? WHERE user_id = ? AND user_id_ulid IS NULL`,
        [normalizedUserId, row.user_id],
      );
    }
  }

  private async backfillBatchUlids(queryRunner: QueryRunner): Promise<void> {
    const batches: Array<{ batch_id: string; created_at: Date | string | null }> = await queryRunner.query(`
      SELECT batch_id, MIN(created_at) AS created_at
      FROM allocation_recommendation
      WHERE batch_id_ulid IS NULL
      GROUP BY batch_id
      ORDER BY created_at ASC, batch_id ASC
    `);

    for (const batch of batches) {
      const createdAtMs = batch.created_at ? new Date(batch.created_at).getTime() : undefined;
      const timeMs = createdAtMs != null && Number.isFinite(createdAtMs) ? createdAtMs : undefined;
      await queryRunner.query(
        `UPDATE allocation_recommendation SET batch_id_ulid = ? WHERE batch_id = ? AND batch_id_ulid IS NULL`,
        [this.ulid(timeMs), batch.batch_id],
      );
    }
  }

  private async runPreflightChecks(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.idTables) {
      await this.assertNoNull(queryRunner, table, 'id_ulid');
      await this.assertNoDuplicates(queryRunner, table, 'id_ulid');
    }

    await this.assertNoNullWhenOldNotNull(queryRunner, 'allocation_recommendation', 'batch_id', 'batch_id_ulid');
    await this.assertNoNullWhenOldNotNull(queryRunner, 'user', 'id', 'legacy_id');
    await this.assertNoDuplicates(queryRunner, 'user', 'legacy_id');

    for (const plan of this.swapColumnPlans) {
      await this.assertNoNullWhenOldNotNull(queryRunner, plan.table, plan.oldColumn, plan.newColumn);
    }

    await this.assertNoNullWhenOldNotNull(queryRunner, 'user_roles_role', 'user_id', 'user_id_ulid');
    await this.assertNoNullWhenOldNotNull(queryRunner, 'user_roles_role', 'role_id', 'role_id_ulid');
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
    const rows: Array<{ count: string | number }> = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM \`${tableName}\` WHERE \`${oldColumn}\` IS NOT NULL AND \`${newColumn}\` IS NULL`,
    );

    if (Number(rows[0]?.count ?? 0) > 0) {
      throw new Error(`[ulid cutover] ${tableName}.${newColumn} is NULL while ${oldColumn} is NOT NULL`);
    }
  }

  private async captureAndDropForeignKeys(
    queryRunner: QueryRunner,
    tableName: string,
    columns: string[],
  ): Promise<TableForeignKey[]> {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return [];
    }

    const matches = table.foreignKeys.filter((foreignKey) =>
      foreignKey.columnNames.some((columnName) => columns.includes(columnName)),
    );

    for (const foreignKey of matches) {
      await queryRunner.dropForeignKey(tableName, foreignKey);
    }

    return matches.map(
      (foreignKey) =>
        new TableForeignKey({
          name: foreignKey.name,
          columnNames: [...foreignKey.columnNames],
          referencedTableName: foreignKey.referencedTableName,
          referencedColumnNames: [...foreignKey.referencedColumnNames],
          onDelete: foreignKey.onDelete,
          onUpdate: foreignKey.onUpdate,
        }),
    );
  }

  private async swapPrimaryIdColumn(queryRunner: QueryRunner, tableName: string): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }

    const hasIdColumn = !!table.findColumnByName('id');
    const hasIdUlidColumn = !!table.findColumnByName('id_ulid');

    if (!hasIdUlidColumn) {
      return;
    }

    if (table.primaryColumns.length > 0) {
      await queryRunner.query(`ALTER TABLE \`${tableName}\` DROP PRIMARY KEY`);
    }

    if (hasIdColumn) {
      await queryRunner.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`id\``);
    }

    await queryRunner.query(`
      ALTER TABLE \`${tableName}\`
      CHANGE COLUMN \`id_ulid\` \`id\` CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
    `);

    await queryRunner.query(`ALTER TABLE \`${tableName}\` ADD PRIMARY KEY (\`id\`)`);
  }

  private async swapColumnToUlid(
    queryRunner: QueryRunner,
    tableName: string,
    oldColumn: string,
    newColumn: string,
    nullable: boolean,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }

    const hasNewColumn = !!table.findColumnByName(newColumn);
    if (!hasNewColumn) {
      return;
    }

    const hasOldColumn = !!table.findColumnByName(oldColumn);
    if (hasOldColumn) {
      await queryRunner.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${oldColumn}\``);
    }

    await queryRunner.query(`
      ALTER TABLE \`${tableName}\`
      CHANGE COLUMN \`${newColumn}\` \`${oldColumn}\` CHAR(26) CHARACTER SET ascii COLLATE ascii_bin ${nullable ? 'NULL' : 'NOT NULL'}
    `);
  }

  private async swapUserRolesJoinColumns(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('user_roles_role');
    if (!hasTable) {
      return;
    }

    const table = await queryRunner.getTable('user_roles_role');
    if (!table) {
      return;
    }

    const hasUserIdUlid = !!table.findColumnByName('user_id_ulid');
    const hasRoleIdUlid = !!table.findColumnByName('role_id_ulid');

    if (!hasUserIdUlid || !hasRoleIdUlid) {
      return;
    }

    if (table.primaryColumns.length > 0) {
      await queryRunner.query('ALTER TABLE `user_roles_role` DROP PRIMARY KEY');
    }

    if (table.findColumnByName('user_id')) {
      await queryRunner.query('ALTER TABLE `user_roles_role` DROP COLUMN `user_id`');
    }

    if (table.findColumnByName('role_id')) {
      await queryRunner.query('ALTER TABLE `user_roles_role` DROP COLUMN `role_id`');
    }

    await queryRunner.query(`
      ALTER TABLE \`user_roles_role\`
      CHANGE COLUMN \`user_id_ulid\` \`user_id\` CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      CHANGE COLUMN \`role_id_ulid\` \`role_id\` CHAR(26) CHARACTER SET ascii COLLATE ascii_bin NOT NULL
    `);

    await queryRunner.query('ALTER TABLE `user_roles_role` ADD PRIMARY KEY (`user_id`, `role_id`)');
  }

  private async dropSeqColumn(queryRunner: QueryRunner, tableName: string): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }

    const seqColumn = table.findColumnByName('seq');
    if (!seqColumn) {
      return;
    }

    const seqIndices = table.indices.filter((index) => index.columnNames.includes('seq'));
    for (const index of seqIndices) {
      await queryRunner.dropIndex(tableName, index);
    }

    await queryRunner.dropColumn(tableName, seqColumn);
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columnNames: string[],
    isUnique = false,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }

    const exists = table.indices.some((index) => index.name === indexName);
    if (exists) {
      return;
    }

    await queryRunner.createIndex(
      tableName,
      new TableIndex({
        name: indexName,
        columnNames,
        isUnique,
      }),
    );
  }

  private async dropIndexIfExists(queryRunner: QueryRunner, tableName: string, indexName: string): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }

    const index = table.indices.find((item) => item.name === indexName);
    if (!index) {
      return;
    }

    await queryRunner.dropIndex(tableName, index);
  }
}
