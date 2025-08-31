import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class Migration1756661592912 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // inference 테이블을 balance_recommendation으로 이름 변경
    await queryRunner.renameTable('inference', 'balance_recommendation');

    // rate 컬럼을 nullable로 변경
    const table = await queryRunner.getTable('balance_recommendation');
    const oldRateColumn = table.findColumnByName('rate');

    const newRateColumn = new TableColumn({
      name: 'rate',
      type: 'double',
      default: 0,
      isNullable: true,
    });

    await queryRunner.changeColumn('balance_recommendation', oldRateColumn, newRateColumn);

    // market_recommendation 테이블 생성
    await queryRunner.createTable(
      new Table({
        name: 'market_recommendation',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'symbol',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'weight',
            type: 'decimal',
            precision: 3,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'confidence',
            type: 'decimal',
            precision: 3,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'batch_id',
            type: 'varchar',
            length: '50',
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

    // market_recommendation 테이블 인덱스 생성
    await queryRunner.createIndex(
      'market_recommendation',
      new TableIndex({
        name: 'idx_market_recommendation_symbol',
        columnNames: ['symbol'],
      }),
    );

    await queryRunner.createIndex(
      'market_recommendation',
      new TableIndex({
        name: 'idx_market_recommendation_batch_id',
        columnNames: ['batch_id'],
      }),
    );

    await queryRunner.createIndex(
      'market_recommendation',
      new TableIndex({
        name: 'idx_market_recommendation_created_at',
        columnNames: ['created_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // market_recommendation 테이블 삭제
    await queryRunner.dropTable('market_recommendation');

    // balance_recommendation 테이블을 inference로 이름 변경
    await queryRunner.renameTable('balance_recommendation', 'inference');

    // rate 컬럼을 NOT NULL로 변경
    const table = await queryRunner.getTable('inference');
    const oldRateColumn = table.findColumnByName('rate');

    const newRateColumn = new TableColumn({
      name: 'rate',
      type: 'double',
      default: 0,
      isNullable: false,
    });

    await queryRunner.changeColumn('inference', oldRateColumn, newRateColumn);
  }
}
