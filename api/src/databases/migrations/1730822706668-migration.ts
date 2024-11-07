import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class Migration1730822706668 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'trade',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['buy', 'sell'],
            isNullable: false,
          },
          {
            name: 'symbol',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'market',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'double',
            isNullable: false,
          },
          {
            name: 'balances',
            type: 'longtext',
            charset: 'utf8mb4',
            collation: 'utf8mb4_bin',
            default: "'{}'",
            isNullable: false,
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
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'inference_id',
            type: 'uuid',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.query(`ALTER TABLE trade ADD CHECK (json_valid(balances))`);

    await queryRunner.createForeignKey(
      'trade',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user',
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createForeignKey(
      'trade',
      new TableForeignKey({
        columnNames: ['inference_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'inference',
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        columnNames: ['inference_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'trade',
      new TableIndex({
        columnNames: ['user_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('trade');
  }
}
