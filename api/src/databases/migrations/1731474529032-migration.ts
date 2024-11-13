import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1731474529032 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('inference', [
      new TableColumn({
        name: 'symbol_rate_lower',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
      new TableColumn({
        name: 'symbol_rate_upper',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('inference', ['symbol_rate_lower', 'symbol_rate_upper']);
  }
}
