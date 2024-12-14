import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1734157811913 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // balances 컬럼 삭제
    await queryRunner.dropColumn('trade', 'balances');

    // profit 컬럼 추가
    await queryRunner.addColumn(
      'trade',
      new TableColumn({
        name: 'profit',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // profit 컬럼 삭제
    await queryRunner.dropColumn('trade', 'profit');

    // balances 컬럼 다시 추가
    await queryRunner.addColumn(
      'trade',
      new TableColumn({
        name: 'balances',
        type: 'longtext',
        default: "'{}'",
        isNullable: false,
      }),
    );
  }
}
