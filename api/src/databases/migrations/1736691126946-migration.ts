import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1736691126946 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameTable('trade_history', 'history');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.renameTable('history', 'trade_history');
  }
}
