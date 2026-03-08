import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1772900600000 implements MigrationInterface {
  name = 'Migration1772900600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `trade` ADD `decisionExecutionUrgency` varchar(16) NULL');
    await queryRunner.query('ALTER TABLE `trade` ADD `realizedCostRate` double NULL');
    await queryRunner.query('ALTER TABLE `trade` ADD `costCalibrationCoefficient` double NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `trade` DROP COLUMN `costCalibrationCoefficient`');
    await queryRunner.query('ALTER TABLE `trade` DROP COLUMN `realizedCostRate`');
    await queryRunner.query('ALTER TABLE `trade` DROP COLUMN `decisionExecutionUrgency`');
  }
}
