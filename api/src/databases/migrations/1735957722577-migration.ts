import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1735957722577 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // rate 값을 0~1에서 -1~1로 스케일링
    await queryRunner.query(`
      UPDATE inference
      SET rate = rate * 2 - 1
      WHERE rate >= 0 AND rate <= 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // rate 값을 -1~1에서 0~1로 되돌리기
    await queryRunner.query(`
      UPDATE inference
      SET rate = (rate + 1) / 2
      WHERE rate >= -1 AND rate <= 1
    `);
  }
}
