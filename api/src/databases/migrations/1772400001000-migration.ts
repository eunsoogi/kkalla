import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

interface UlidLinkColumn {
  table: string;
  oldColumn: string;
  newColumn: string;
  nullable: boolean;
}

export class Migration1772400001000 implements MigrationInterface {
  public readonly transaction = false;
  private static readonly MIGRATION_LOCK_NAME = 'migration:1772400001000:ulid-cutover';
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

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.withMigrationLock(queryRunner, () => this.prepareUlidColumns(queryRunner));
  }

  public async down(): Promise<void> {
    throw new Error('Migration1772400001000 down migration is not supported');
  }

  private async withMigrationLock(queryRunner: QueryRunner, callback: () => Promise<void>): Promise<void> {
    const rows: Array<{ acquired: string | number | null }> = await queryRunner.query(
      'SELECT GET_LOCK(?, ?) AS acquired',
      [Migration1772400001000.MIGRATION_LOCK_NAME, Migration1772400001000.MIGRATION_LOCK_TIMEOUT_SECONDS],
    );

    if (Number(rows[0]?.acquired ?? 0) !== 1) {
      throw new Error('[ulid cutover] failed to acquire migration lock for Migration1772400001000');
    }

    try {
      await callback();
    } finally {
      try {
        await queryRunner.query('SELECT RELEASE_LOCK(?)', [Migration1772400001000.MIGRATION_LOCK_NAME]);
      } catch {
        // noop
      }
    }
  }

  private async prepareUlidColumns(queryRunner: QueryRunner): Promise<void> {
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
}
