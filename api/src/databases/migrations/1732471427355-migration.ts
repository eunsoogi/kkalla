import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class Migration1732471427355 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
            enum: ['BUY', 'SELL', 'HOLD'],
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('decision_users_user');
    await queryRunner.dropTable('decision');
  }
}
