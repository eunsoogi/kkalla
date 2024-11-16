import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1731742365469 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `inference` CHANGE `rate` `order_ratio` DOUBLE NOT NULL DEFAULT 0');

    await queryRunner.query(
      'ALTER TABLE `inference` CHANGE `symbol_rate_lower` `weight_lower_bound` DOUBLE NOT NULL DEFAULT 0',
    );

    await queryRunner.query(
      'ALTER TABLE `inference` CHANGE `symbol_rate_upper` `weight_upper_bound` DOUBLE NOT NULL DEFAULT 0',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `inference` CHANGE `order_ratio` `rate` DOUBLE NOT NULL DEFAULT 0');

    await queryRunner.query(
      'ALTER TABLE `inference` CHANGE `weight_lower_bound` `symbol_rate_lower` DOUBLE NOT NULL DEFAULT 0',
    );

    await queryRunner.query(
      'ALTER TABLE `inference` CHANGE `weight_upper_bound` `symbol_rate_upper` DOUBLE NOT NULL DEFAULT 0',
    );
  }
}
