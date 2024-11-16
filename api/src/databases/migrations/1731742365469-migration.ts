import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1731742365469 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn('inference', 'rate', 'order_ratio');
    await queryRunner.renameColumn('inference', 'symbol_rate_lower', 'weight_lower_bound');
    await queryRunner.renameColumn('inference', 'symbol_rate_upper', 'weight_upper_bound');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameColumn('inference', 'order_ratio', 'rate');
    await queryRunner.renameColumn('inference', 'weight_lower_bound', 'symbol_rate_lower');
    await queryRunner.renameColumn('inference', 'weight_upper_bound', 'symbol_rate_upper');
  }
}
