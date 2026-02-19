import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1771515600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE report_validation_item
      SET status = 'pending',
          gpt_verdict = NULL,
          gpt_score = NULL,
          gpt_calibration = NULL,
          gpt_explanation = NULL,
          next_guardrail = NULL,
          evaluated_at = NULL,
          error = '[migration] Requeue validation item for retry',
          updated_at = DATE_SUB(NOW(), INTERVAL 31 MINUTE)
      WHERE status IN ('pending', 'running', 'completed', 'failed')
        AND due_at <= NOW()
    `);

    await queryRunner.query(`
      UPDATE report_validation_run
      SET status = 'running',
          completed_at = NULL,
          error = '[migration] Requeued validation items for retry',
          updated_at = NOW()
      WHERE id IN (
        SELECT requeue.run_id
        FROM (
          SELECT DISTINCT run_id
          FROM report_validation_item
          WHERE status = 'pending'
            AND error = '[migration] Requeue validation item for retry'
        ) AS requeue
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    // one-way data correction migration
  }
}
