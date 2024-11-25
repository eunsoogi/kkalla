import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1732541738255 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('inference', [
      'decision',
      'order_ratio',
      'weight_lower_bound',
      'weight_upper_bound',
      'reason',
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('inference', [
      new TableColumn({
        name: 'decision',
        type: 'enum',
        enum: ['BUY', 'SELL', 'HOLD'],
        isNullable: false,
      }),
      new TableColumn({
        name: 'order_ratio',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
      new TableColumn({
        name: 'weight_lower_bound',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
      new TableColumn({
        name: 'weight_upper_bound',
        type: 'double',
        default: 0,
        isNullable: false,
      }),
      new TableColumn({
        name: 'reason',
        type: 'text',
        isNullable: false,
      }),
    ]);
  }
}
