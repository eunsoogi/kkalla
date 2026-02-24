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
    const cutoverCompleted = await this.isCutoverCompleted(queryRunner);
    if (cutoverCompleted) {
      return;
    }

    await this.applyUlidCutover(queryRunner);
  }

  public async down(): Promise<void> {
    throw new Error('Migration1772400004000 down migration is not supported');
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

  private async applyUlidCutover(queryRunner: QueryRunner): Promise<void> {
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
}
