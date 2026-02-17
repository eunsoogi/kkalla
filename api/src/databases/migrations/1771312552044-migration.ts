import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1771312552044 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasPrevRate = await queryRunner.hasColumn('balance_recommendation', 'prev_rate');

    if (hasPrevRate) {
      return;
    }

    await queryRunner.addColumn(
      'balance_recommendation',
      new TableColumn({
        name: 'prev_rate',
        type: 'double',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasPrevRate = await queryRunner.hasColumn('balance_recommendation', 'prev_rate');

    if (!hasPrevRate) {
      return;
    }

    await queryRunner.dropColumn('balance_recommendation', 'prev_rate');
  }
}
