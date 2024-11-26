import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1732579603589 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE decision
      SET decision = LOWER(decision)
    `);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async down(queryRunner: QueryRunner): Promise<void> {}
}
