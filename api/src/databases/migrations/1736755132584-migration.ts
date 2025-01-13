import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1736755132584 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 모든 사용자 조회
    const users = await queryRunner.query(`SELECT id FROM user`);

    // 각 사용자에 대해 카테고리 생성
    for (const user of users) {
      const categories = ['coin_major', 'coin_minor', 'nasdaq'];

      for (const category of categories) {
        await queryRunner.query(
          `INSERT INTO user_category (id, user_id, category, enabled, created_at, updated_at)
           VALUES (UUID(), ?, ?, 1, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))`,
          [user.id, category],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 생성된 모든 카테고리 삭제
    await queryRunner.query(`DELETE FROM user_category`);
  }
}
