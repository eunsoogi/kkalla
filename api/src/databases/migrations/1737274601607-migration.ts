import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1737274601607 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX "idx_notify_user_seq" ON "notify" ("user_id" ASC, "seq" DESC)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_notify_user_seq"`);
  }
}
