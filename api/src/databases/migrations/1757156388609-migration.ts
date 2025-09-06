import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class Migration1757156388609 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('balance_recommendation');

    // ticker 컬럼을 symbol 컬럼으로 변경
    const oldTickerColumn = table.findColumnByName('ticker');
    if (oldTickerColumn) {
      const newSymbolColumn = new TableColumn({
        name: 'symbol',
        type: 'varchar',
        length: '255',
        isNullable: false,
      });

      await queryRunner.changeColumn('balance_recommendation', oldTickerColumn, newSymbolColumn);
    }

    // batch_id 컬럼 추가
    const batchIdColumn = new TableColumn({
      name: 'batch_id',
      type: 'uuid',
      isNullable: false,
      default: 'UUID()',
    });

    await queryRunner.addColumn('balance_recommendation', batchIdColumn);

    // default 제거
    const batchIdColumnWithoutDefault = new TableColumn({
      name: 'batch_id',
      type: 'uuid',
      isNullable: false,
    });

    await queryRunner.changeColumn('balance_recommendation', batchIdColumn, batchIdColumnWithoutDefault);

    // batch_id와 symbol의 복합 유니크 인덱스 생성
    const uniqueIndex = new TableIndex({
      name: 'idx_balance_recommendation_batch_id_symbol',
      columnNames: ['batch_id', 'symbol'],
      isUnique: true,
    });

    await queryRunner.createIndex('balance_recommendation', uniqueIndex);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 유니크 인덱스 삭제
    await queryRunner.dropIndex('balance_recommendation', 'idx_balance_recommendation_batch_id_symbol');

    // batch_id 컬럼 삭제
    await queryRunner.dropColumn('balance_recommendation', 'batch_id');

    // symbol 컬럼을 ticker 컬럼으로 변경
    const table = await queryRunner.getTable('balance_recommendation');
    const oldSymbolColumn = table.findColumnByName('symbol');

    if (oldSymbolColumn) {
      const newTickerColumn = new TableColumn({
        name: 'ticker',
        type: 'varchar',
        length: '255',
        isNullable: false,
      });

      await queryRunner.changeColumn('balance_recommendation', oldSymbolColumn, newTickerColumn);
    }
  }
}
