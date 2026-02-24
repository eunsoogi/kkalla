import { MigrationInterface, QueryRunner, TableForeignKey, TableIndex } from 'typeorm';

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

export class Migration1772400004000 implements MigrationInterface {
  public readonly transaction = false;

  private static readonly FOREIGN_KEY_PLAN_TABLE = '_migration_1772400004000_fk_plan';
  private static readonly MIGRATION_LOCK_NAME = 'migration:1772400001000-4000:ulid-cutover';
  private static readonly MIGRATION_LOCK_TIMEOUT_SECONDS = 3600;

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
    await this.withMigrationLock(queryRunner, () => this.applyUlidCutover(queryRunner));
  }

  public async down(): Promise<void> {
    throw new Error('Migration1772400004000 down migration is not supported');
  }

  private async withMigrationLock(queryRunner: QueryRunner, callback: () => Promise<void>): Promise<void> {
    const rows: Array<{ acquired: string | number | null }> = await queryRunner.query(
      'SELECT GET_LOCK(?, ?) AS acquired',
      [Migration1772400004000.MIGRATION_LOCK_NAME, Migration1772400004000.MIGRATION_LOCK_TIMEOUT_SECONDS],
    );

    if (Number(rows[0]?.acquired ?? 0) !== 1) {
      throw new Error('[ulid cutover] failed to acquire migration lock for Migration1772400004000');
    }

    try {
      await callback();
    } finally {
      try {
        await queryRunner.query('SELECT RELEASE_LOCK(?)', [Migration1772400004000.MIGRATION_LOCK_NAME]);
      } catch {
        // noop
      }
    }
  }

  private async applyUlidCutover(queryRunner: QueryRunner): Promise<void> {
    await this.ensureForeignKeyPlanTable(queryRunner);

    for (const plan of this.fkCapturePlans) {
      await this.persistAndDropForeignKeys(queryRunner, plan.table, plan.columns);
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

    await this.restoreForeignKeysFromPlan(queryRunner);
    await this.dropForeignKeyPlanTable(queryRunner);

    const hasSequenceTable = await queryRunner.hasTable('sequence');
    if (hasSequenceTable) {
      await queryRunner.dropTable('sequence');
    }
  }

  private async ensureForeignKeyPlanTable(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`${Migration1772400004000.FOREIGN_KEY_PLAN_TABLE}\` (
        \`table_name\` VARCHAR(128) NOT NULL,
        \`foreign_key_name\` VARCHAR(191) NOT NULL,
        \`column_names\` TEXT NOT NULL,
        \`referenced_table_name\` VARCHAR(128) NOT NULL,
        \`referenced_column_names\` TEXT NOT NULL,
        \`on_delete\` VARCHAR(32) NULL,
        \`on_update\` VARCHAR(32) NULL,
        PRIMARY KEY (\`table_name\`, \`foreign_key_name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private async persistAndDropForeignKeys(
    queryRunner: QueryRunner,
    tableName: string,
    columns: string[],
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }

    const matches = table.foreignKeys.filter((foreignKey) =>
      foreignKey.columnNames.some((columnName) => columns.includes(columnName)),
    );

    for (const foreignKey of matches) {
      if (!foreignKey.referencedTableName) {
        continue;
      }

      const persistedForeignKeyName = this.toPersistedForeignKeyName(foreignKey);

      await queryRunner.query(
        `INSERT IGNORE INTO \`${Migration1772400004000.FOREIGN_KEY_PLAN_TABLE}\`
          (\`table_name\`, \`foreign_key_name\`, \`column_names\`, \`referenced_table_name\`, \`referenced_column_names\`, \`on_delete\`, \`on_update\`)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tableName,
          persistedForeignKeyName,
          JSON.stringify(foreignKey.columnNames),
          foreignKey.referencedTableName,
          JSON.stringify(foreignKey.referencedColumnNames),
          foreignKey.onDelete ?? null,
          foreignKey.onUpdate ?? null,
        ],
      );
    }

    for (const foreignKey of matches) {
      await queryRunner.dropForeignKey(tableName, foreignKey);
    }
  }

  private async restoreForeignKeysFromPlan(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{
      table_name: string;
      foreign_key_name: string;
      column_names: string;
      referenced_table_name: string;
      referenced_column_names: string;
      on_delete: string | null;
      on_update: string | null;
    }> = await queryRunner.query(
      `SELECT
         table_name,
         foreign_key_name,
         column_names,
         referenced_table_name,
         referenced_column_names,
         on_delete,
         on_update
       FROM \`${Migration1772400004000.FOREIGN_KEY_PLAN_TABLE}\`
       ORDER BY table_name ASC, foreign_key_name ASC`,
    );

    for (const row of rows) {
      const table = await queryRunner.getTable(row.table_name);
      if (!table) {
        continue;
      }

      const foreignKey = new TableForeignKey({
        name: row.foreign_key_name,
        columnNames: this.parsePersistedColumns(row.column_names),
        referencedTableName: row.referenced_table_name,
        referencedColumnNames: this.parsePersistedColumns(row.referenced_column_names),
        onDelete: row.on_delete ?? undefined,
        onUpdate: row.on_update ?? undefined,
      });

      const exists = table.foreignKeys.some((existing) => this.isSameForeignKey(existing, foreignKey));
      if (exists) {
        continue;
      }

      await queryRunner.createForeignKey(row.table_name, foreignKey);
    }
  }

  private async dropForeignKeyPlanTable(queryRunner: QueryRunner): Promise<void> {
    const hasPlanTable = await queryRunner.hasTable(Migration1772400004000.FOREIGN_KEY_PLAN_TABLE);
    if (!hasPlanTable) {
      return;
    }

    await queryRunner.dropTable(Migration1772400004000.FOREIGN_KEY_PLAN_TABLE);
  }

  private parsePersistedColumns(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map((value) => String(value));
    } catch {
      return [];
    }
  }

  private toPersistedForeignKeyName(foreignKey: TableForeignKey): string {
    if (foreignKey.name) {
      return foreignKey.name;
    }

    const columnPart = foreignKey.columnNames.join('_');
    const referencedColumnPart = foreignKey.referencedColumnNames.join('_');
    const referencedTableName = foreignKey.referencedTableName ?? 'unknown';
    return `fk_${columnPart}_${referencedTableName}_${referencedColumnPart}`.slice(0, 191);
  }

  private isSameForeignKey(left: TableForeignKey, right: TableForeignKey): boolean {
    if (left.name && right.name) {
      return left.name === right.name;
    }

    return (
      left.referencedTableName === right.referencedTableName &&
      left.columnNames.join(',') === right.columnNames.join(',') &&
      left.referencedColumnNames.join(',') === right.referencedColumnNames.join(',')
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
    const hasTable = await queryRunner.hasTable(tableName);
    if (!hasTable) {
      return;
    }

    const hasNewColumn = await this.hasColumnInSchema(queryRunner, tableName, newColumn);
    if (!hasNewColumn) {
      return;
    }

    const hasOldColumn = await this.hasColumnInSchema(queryRunner, tableName, oldColumn);
    if (hasOldColumn) {
      await this.dropColumnSafely(queryRunner, tableName, oldColumn);
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

    const hasUserIdUlidBeforeSwap = await this.hasColumnInSchema(queryRunner, 'user_roles_role', 'user_id_ulid');
    const hasRoleIdUlidBeforeSwap = await this.hasColumnInSchema(queryRunner, 'user_roles_role', 'role_id_ulid');
    const swapNeeded = hasUserIdUlidBeforeSwap || hasRoleIdUlidBeforeSwap;

    const primaryColumnsBeforeSwap = await this.getPrimaryKeyColumns(queryRunner, 'user_roles_role');
    if (swapNeeded && primaryColumnsBeforeSwap.length > 0) {
      await queryRunner.query('ALTER TABLE `user_roles_role` DROP PRIMARY KEY');
    }

    await this.swapColumnToUlid(queryRunner, 'user_roles_role', 'user_id', 'user_id_ulid', false);
    await this.swapColumnToUlid(queryRunner, 'user_roles_role', 'role_id', 'role_id_ulid', false);

    const hasUserId = await this.hasColumnInSchema(queryRunner, 'user_roles_role', 'user_id');
    const hasRoleId = await this.hasColumnInSchema(queryRunner, 'user_roles_role', 'role_id');
    if (!hasUserId || !hasRoleId) {
      throw new Error(
        `[ulid cutover] user_roles_role column swap incomplete (user_id: ${hasUserId}, role_id: ${hasRoleId})`,
      );
    }

    const isUserIdUlidColumn = await this.isUlidAsciiColumn(queryRunner, 'user_roles_role', 'user_id');
    const isRoleIdUlidColumn = await this.isUlidAsciiColumn(queryRunner, 'user_roles_role', 'role_id');
    if (!isUserIdUlidColumn || !isRoleIdUlidColumn) {
      throw new Error(
        `[ulid cutover] user_roles_role columns are not ULID-compatible (user_id: ${isUserIdUlidColumn}, role_id: ${isRoleIdUlidColumn})`,
      );
    }

    const primaryColumnsAfterSwap = await this.getPrimaryKeyColumns(queryRunner, 'user_roles_role');
    const hasExpectedPrimaryAfterSwap =
      primaryColumnsAfterSwap.length === 2 &&
      primaryColumnsAfterSwap[0] === 'user_id' &&
      primaryColumnsAfterSwap[1] === 'role_id';

    if (!hasExpectedPrimaryAfterSwap) {
      if (primaryColumnsAfterSwap.length > 0) {
        await queryRunner.query('ALTER TABLE `user_roles_role` DROP PRIMARY KEY');
      }

      await queryRunner.query('ALTER TABLE `user_roles_role` ADD PRIMARY KEY (`user_id`, `role_id`)');
    }
  }

  private async hasColumnInSchema(queryRunner: QueryRunner, tableName: string, columnName: string): Promise<boolean> {
    const rows: Array<{ count: string | number }> = await queryRunner.query(
      `
        SELECT COUNT(*) AS count
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
      `,
      [tableName, columnName],
    );

    return Number(rows[0]?.count ?? 0) > 0;
  }

  private async getPrimaryKeyColumns(queryRunner: QueryRunner, tableName: string): Promise<string[]> {
    const rows: Array<{ column_name: string }> = await queryRunner.query(
      `
        SELECT COLUMN_NAME AS column_name
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND CONSTRAINT_NAME = 'PRIMARY'
        ORDER BY ORDINAL_POSITION ASC
      `,
      [tableName],
    );

    return rows.map((row) => row.column_name);
  }

  private async isUlidAsciiColumn(queryRunner: QueryRunner, tableName: string, columnName: string): Promise<boolean> {
    const rows: Array<{
      data_type: string | null;
      character_maximum_length: string | number | null;
      character_set_name: string | null;
      collation_name: string | null;
    }> = await queryRunner.query(
      `
        SELECT
          DATA_TYPE AS data_type,
          CHARACTER_MAXIMUM_LENGTH AS character_maximum_length,
          CHARACTER_SET_NAME AS character_set_name,
          COLLATION_NAME AS collation_name
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
        LIMIT 1
      `,
      [tableName, columnName],
    );

    const column = rows[0];
    if (!column) {
      return false;
    }

    return (
      String(column.data_type ?? '').toLowerCase() === 'char' &&
      Number(column.character_maximum_length ?? 0) === 26 &&
      String(column.character_set_name ?? '').toLowerCase() === 'ascii' &&
      String(column.collation_name ?? '').toLowerCase() === 'ascii_bin'
    );
  }

  private async dropColumnSafely(queryRunner: QueryRunner, tableName: string, columnName: string): Promise<void> {
    try {
      await queryRunner.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``);
      return;
    } catch (error) {
      const shouldRetry = this.isRetriableDropColumnError(error);
      if (!shouldRetry) {
        throw error;
      }
    }

    await this.dropIndexesContainingColumn(queryRunner, tableName, columnName);

    const stillExists = await this.hasColumnInSchema(queryRunner, tableName, columnName);
    if (!stillExists) {
      return;
    }

    await queryRunner.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``);
  }

  private isRetriableDropColumnError(error: unknown): boolean {
    const code = String((error as { code?: unknown })?.code ?? '');
    const errno = Number((error as { errno?: unknown })?.errno ?? 0);
    return code === 'ER_KEY_COLUMN_DOES_NOT_EXITS' || errno === 1072 || errno === 1091;
  }

  private async dropIndexesContainingColumn(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    if (!table) {
      return;
    }

    const indexes = table.indices.filter((index) => index.columnNames.includes(columnName));
    for (const index of indexes) {
      await queryRunner.dropIndex(tableName, index);
    }
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
}
