import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1733113261904 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'trade',
      new TableColumn({
        name: 'ticker',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.query('UPDATE trade SET ticker = CONCAT(symbol, "/", market)');

    await queryRunner.changeColumn(
      'trade',
      'ticker',
      new TableColumn({
        name: 'ticker',
        type: 'varchar',
        length: '255',
        isNullable: false,
      }),
    );

    await queryRunner.dropColumns('trade', ['symbol', 'market']);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('trade', [
      new TableColumn({
        name: 'symbol',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'market',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    ]);

    await queryRunner.query('UPDATE trade SET symbol = SUBSTRING_INDEX(ticker, "/", 1)');
    await queryRunner.query('UPDATE trade SET market = SUBSTRING_INDEX(ticker, "/", -1)');

    await queryRunner.changeColumn(
      'trade',
      'symbol',
      new TableColumn({
        name: 'symbol',
        type: 'varchar',
        length: '255',
        isNullable: false,
      }),
    );

    await queryRunner.changeColumn(
      'trade',
      'market',
      new TableColumn({
        name: 'market',
        type: 'varchar',
        length: '255',
        isNullable: false,
      }),
    );

    await queryRunner.dropColumn('trade', 'ticker');
  }
}
