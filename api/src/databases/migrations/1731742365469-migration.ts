import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1731742365469 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn(
      'inference',
      'rate',
      new TableColumn({
        name: 'order_ratio',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.renameColumn(
      'inference',
      'symbol_rate_lower',
      new TableColumn({
        name: 'weight_lower_bound',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.renameColumn(
      'inference',
      'symbol_rate_upper',
      new TableColumn({
        name: 'weight_upper_bound',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn(
      'inference',
      'order_ratio',
      new TableColumn({
        name: 'rate',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.renameColumn(
      'inference',
      'weight_lower_bound',
      new TableColumn({
        name: 'symbol_rate_lower',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
    );

    await queryRunner.renameColumn(
      'inference',
      'weight_upper_bound',
      new TableColumn({
        name: 'symbol_rate_upper',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
    );
  }
}
