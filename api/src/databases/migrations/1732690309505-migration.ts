import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1732690309505 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `decision_users_user` ADD PRIMARY KEY (`decision_id`, `user_id`)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `decision_users_user` DROP PRIMARY KEY');
  }
}
