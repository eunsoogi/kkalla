import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1732495065937 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const inferences = await queryRunner.query(`SELECT * FROM inference ORDER BY created_at ASC`);

    for (const inference of inferences) {
      await queryRunner.query(`INSERT INTO sequence () VALUES ()`);
      const sequence = await queryRunner.query(`SELECT value FROM sequence ORDER BY value DESC LIMIT 1`);
      const seqValue = sequence[0].value;

      await queryRunner.query(
        `INSERT INTO decision (id, seq, inference_id, decision, order_ratio, weight_lower_bound, weight_upper_bound, reason, created_at, updated_at)
          VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          seqValue,
          inference['id'],
          inference['decision'],
          inference['order_ratio'],
          inference['weight_lower_bound'],
          inference['weight_upper_bound'],
          inference['reason'],
          inference['created_at'],
          inference['updated_at'],
        ],
      );
    }

    await queryRunner.query(`
      INSERT INTO decision_users_user (decision_id, user_id)
      SELECT d.id as decision_id, u.user_id
      FROM decision d
      INNER JOIN inference i ON i.id = d.inference_id
      INNER JOIN inference_users_user u ON u.inference_id = i.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const decisions = await queryRunner.query(`SELECT * FROM decision`);

    for (const decision of decisions) {
      await queryRunner.query(
        `UPDATE inference
        SET decision = ?, order_ratio = ?, weight_lower_bound = ?, weight_upper_bound = ?, reason = ?
        WHERE id = ?`,
        [
          decision['decision'],
          decision['order_ratio'],
          decision['weight_lower_bound'],
          decision['weight_upper_bound'],
          decision['reason'],
          decision['inference_id'],
        ],
      );
    }

    await queryRunner.query(`
      INSERT INTO inference_users_user (inference_id, user_id)
      SELECT d.inference_id, du.user_id
      FROM decision d
      INNER JOIN decision_users_user du ON du.decision_id = d.id
    `);
  }
}
