import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1757156550577 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('history');

    // ticker 컬럼을 symbol 컬럼으로 변경
    const oldTickerColumn = table.findColumnByName('ticker');
    const newSymbolColumn = new TableColumn({
      name: 'symbol',
      type: 'varchar',
      length: '255',
      isNullable: false,
    });

    await queryRunner.changeColumn('history', oldTickerColumn, newSymbolColumn);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('history');

    // symbol 컬럼을 ticker 컬럼으로 변경
    const oldSymbolColumn = table.findColumnByName('symbol');
    const newTickerColumn = new TableColumn({
      name: 'ticker',
      type: 'varchar',
      length: '255',
      isNullable: false,
    });

    await queryRunner.changeColumn('history', oldSymbolColumn, newTickerColumn);
  }
}
