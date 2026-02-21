import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class Migration1772000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const historyTable = await queryRunner.getTable('history');
    const hasUserId = historyTable?.findColumnByName('user_id');

    if (!hasUserId) {
      await queryRunner.addColumn(
        'history',
        new TableColumn({
          name: 'user_id',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    const refreshedHistoryTable = await queryRunner.getTable('history');
    const hasHistoryUserFk = refreshedHistoryTable?.foreignKeys.some((fk) => fk.columnNames.includes('user_id'));

    if (!hasHistoryUserFk) {
      await queryRunner.createForeignKey(
        'history',
        new TableForeignKey({
          columnNames: ['user_id'],
          referencedTableName: 'user',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    await queryRunner.query(`
      INSERT INTO history (id, symbol, category, \`index\`, user_id, created_at, updated_at)
      SELECT UUID(), h.symbol, h.category, MIN(h.\`index\`) AS \`index\`, u.id, NOW(6), NOW(6)
      FROM history h
      CROSS JOIN user u
      JOIN user_category uc
        ON uc.user_id = u.id
       AND uc.category = h.category
       AND uc.enabled = 1
      WHERE h.user_id IS NULL
        AND (
          (
            h.category = 'coin_major'
            AND EXISTS (
              SELECT 1
              FROM user_roles_role urr
              JOIN role r ON r.id = urr.role_id
              WHERE urr.user_id = u.id
                AND CONCAT(',', REPLACE(IFNULL(r.permissions, ''), ' ', ''), ',') LIKE '%,trade:coin:major,%'
            )
          )
          OR (
            h.category = 'coin_minor'
            AND EXISTS (
              SELECT 1
              FROM user_roles_role urr
              JOIN role r ON r.id = urr.role_id
              WHERE urr.user_id = u.id
                AND CONCAT(',', REPLACE(IFNULL(r.permissions, ''), ' ', ''), ',') LIKE '%,trade:coin:minor,%'
            )
          )
          OR (
            h.category = 'nasdaq'
            AND EXISTS (
              SELECT 1
              FROM user_roles_role urr
              JOIN role r ON r.id = urr.role_id
              WHERE urr.user_id = u.id
                AND CONCAT(',', REPLACE(IFNULL(r.permissions, ''), ' ', ''), ',') LIKE '%,trade:nasdaq,%'
            )
          )
        )
      GROUP BY u.id, h.symbol, h.category
    `);

    await queryRunner.query(`DELETE FROM history WHERE user_id IS NULL`);

    const userIdColumn = (await queryRunner.getTable('history'))?.findColumnByName('user_id');
    if (userIdColumn?.isNullable) {
      await queryRunner.changeColumn(
        'history',
        userIdColumn,
        new TableColumn({
          name: 'user_id',
          type: 'uuid',
          isNullable: false,
        }),
      );
    }

    await queryRunner.createIndex(
      'history',
      new TableIndex({
        name: 'idx_history_user_index',
        columnNames: ['user_id', 'index'],
      }),
    );

    await queryRunner.createIndex(
      'history',
      new TableIndex({
        name: 'idx_history_user_symbol_category_unique',
        columnNames: ['user_id', 'symbol', 'category'],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'trade_execution_ledger',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'module',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          {
            name: 'message_key',
            type: 'varchar',
            length: '191',
            isNullable: false,
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '191',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '32',
            default: "'processing'",
            isNullable: false,
          },
          {
            name: 'attempt_count',
            type: 'int',
            default: 1,
            isNullable: false,
          },
          {
            name: 'payload_hash',
            type: 'varchar',
            length: '128',
            isNullable: false,
          },
          {
            name: 'generated_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'finished_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'trade_execution_ledger',
      new TableIndex({
        name: 'idx_trade_execution_ledger_module_message_user',
        columnNames: ['module', 'message_key', 'user_id'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const historyTable = await queryRunner.getTable('history');
    const historyUserUniqueIndex = historyTable?.indices.find(
      (index) => index.name === 'idx_history_user_symbol_category_unique',
    );
    const historyUserIndex = historyTable?.indices.find((index) => index.name === 'idx_history_user_index');

    if (historyUserUniqueIndex) {
      await queryRunner.dropIndex('history', historyUserUniqueIndex);
    }

    if (historyUserIndex) {
      await queryRunner.dropIndex('history', historyUserIndex);
    }

    const userIdColumn = historyTable?.findColumnByName('user_id');
    if (userIdColumn) {
      await queryRunner.changeColumn(
        'history',
        userIdColumn,
        new TableColumn({
          name: 'user_id',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    await queryRunner.query(`
      CREATE TABLE history_rollback AS
      SELECT
        MIN(id) AS id,
        symbol,
        category,
        MIN(\`index\`) AS \`index\`,
        MIN(created_at) AS created_at,
        MAX(updated_at) AS updated_at
      FROM history
      GROUP BY symbol, category
    `);

    await queryRunner.query(`DELETE FROM history`);

    await queryRunner.query(`
      INSERT INTO history (id, symbol, category, \`index\`, created_at, updated_at)
      SELECT id, symbol, category, \`index\`, created_at, updated_at
      FROM history_rollback
    `);

    await queryRunner.query(`DROP TABLE history_rollback`);

    const refreshedHistoryTable = await queryRunner.getTable('history');
    const historyUserFk = refreshedHistoryTable?.foreignKeys.find((fk) => fk.columnNames.includes('user_id'));
    if (historyUserFk) {
      await queryRunner.dropForeignKey('history', historyUserFk);
    }

    const refreshedHistoryUserIdColumn = refreshedHistoryTable?.findColumnByName('user_id');
    if (refreshedHistoryUserIdColumn) {
      await queryRunner.dropColumn('history', 'user_id');
    }

    await queryRunner.dropTable('trade_execution_ledger');
  }
}
