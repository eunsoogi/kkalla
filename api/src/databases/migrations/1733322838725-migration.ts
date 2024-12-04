import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class Migration1733322838725 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // rate 컬럼 추가
    await queryRunner.addColumn(
      'inference',
      new TableColumn({
        name: 'rate',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
    );

    // inference_id 컬럼 추가
    await queryRunner.addColumn(
      'trade',
      new TableColumn({
        name: 'inference_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // decision_id로 inference_id를 찾아서 값 업데이트
    await queryRunner.query(`
      CREATE TEMPORARY TABLE trade_inference_ids AS
      SELECT t.id as trade_id, d.inference_id
      FROM trade t
      JOIN decision d ON t.decision_id = d.id
    `);

    await queryRunner.query(`
      UPDATE trade t
      SET inference_id = (
        SELECT inference_id
        FROM trade_inference_ids
        WHERE trade_id = t.id
      )
    `);

    await queryRunner.dropTable('trade_inference_ids');

    // inference_id 외래키 추가
    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        columnNames: ['inference_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'trade',
      new TableForeignKey({
        columnNames: ['inference_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'inference',
        onDelete: 'SET NULL',
        onUpdate: 'NO ACTION',
      }),
    );

    // decision_id 컬럼 제거
    const foreignKeys = await queryRunner.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'trade'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'decision_id'
        AND tc.table_schema = DATABASE()
    `);

    if (foreignKeys && foreignKeys.length > 0) {
      const foreignKeyName = foreignKeys[0].constraint_name;
      await queryRunner.dropForeignKey('trade', foreignKeyName);
    }

    await queryRunner.dropColumn('trade', 'decision_id');

    // decision 테이블 삭제
    await queryRunner.dropTable('decision_users_user');
    await queryRunner.dropTable('decision');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // decision 테이블 복구
    await queryRunner.createTable(
      new Table({
        name: 'decision',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'seq',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'inference_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'decision',
            type: 'enum',
            enum: ['buy', 'sell', 'hold'],
            isNullable: false,
          },
          {
            name: 'order_ratio',
            type: 'double',
            default: 0,
            isNullable: false,
          },
          {
            name: 'weight_lower_bound',
            type: 'double',
            default: 0,
            isNullable: false,
          },
          {
            name: 'weight_upper_bound',
            type: 'double',
            default: 0,
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
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
      'decision',
      new TableIndex({
        columnNames: ['seq'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'decision',
      new TableIndex({
        columnNames: ['inference_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'decision',
      new TableForeignKey({
        columnNames: ['inference_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'inference',
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'decision_users_user',
        columns: [
          {
            name: 'decision_id',
            type: 'uuid',
          },
          {
            name: 'user_id',
            type: 'uuid',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'decision_users_user',
      new TableForeignKey({
        columnNames: ['decision_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'decision',
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createForeignKey(
      'decision_users_user',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'decision_users_user',
      new TableIndex({
        columnNames: ['decision_id'],
      }),
    );

    await queryRunner.createIndex(
      'decision_users_user',
      new TableIndex({
        columnNames: ['user_id'],
      }),
    );

    // trade 테이블 복구
    const tradeTable = await queryRunner.getTable('trade');
    const tradeForeignKey = tradeTable?.foreignKeys.find((fk) => fk.columnNames.includes('inference_id'));
    if (tradeForeignKey) {
      await queryRunner.dropForeignKey('trade', tradeForeignKey);
    }

    const tradeIndex = tradeTable?.indices.find((index) => index.columnNames.includes('inference_id'));
    if (tradeIndex) {
      await queryRunner.dropIndex('trade', tradeIndex);
    }

    await queryRunner.addColumn(
      'trade',
      new TableColumn({
        name: 'decision_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        columnNames: ['decision_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'trade',
      new TableForeignKey({
        columnNames: ['decision_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'decision',
        onDelete: 'SET NULL',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.dropColumn('trade', 'inference_id');

    // inference 테이블 복구
    await queryRunner.dropColumn('inference', 'rate');
  }
}
