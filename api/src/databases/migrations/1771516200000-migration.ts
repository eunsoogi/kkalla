import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1771516200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasGptVerdict = await queryRunner.hasColumn('report_validation_item', 'gpt_verdict');
    const hasAiVerdict = await queryRunner.hasColumn('report_validation_item', 'ai_verdict');
    if (hasGptVerdict && !hasAiVerdict) {
      await queryRunner.query('ALTER TABLE `report_validation_item` RENAME COLUMN `gpt_verdict` TO `ai_verdict`');
    }

    const hasGptScore = await queryRunner.hasColumn('report_validation_item', 'gpt_score');
    const hasAiScore = await queryRunner.hasColumn('report_validation_item', 'ai_score');
    if (hasGptScore && !hasAiScore) {
      await queryRunner.query('ALTER TABLE `report_validation_item` RENAME COLUMN `gpt_score` TO `ai_score`');
    }

    const hasGptCalibration = await queryRunner.hasColumn('report_validation_item', 'gpt_calibration');
    const hasAiCalibration = await queryRunner.hasColumn('report_validation_item', 'ai_calibration');
    if (hasGptCalibration && !hasAiCalibration) {
      await queryRunner.query(
        'ALTER TABLE `report_validation_item` RENAME COLUMN `gpt_calibration` TO `ai_calibration`',
      );
    }

    const hasGptExplanation = await queryRunner.hasColumn('report_validation_item', 'gpt_explanation');
    const hasAiExplanation = await queryRunner.hasColumn('report_validation_item', 'ai_explanation');
    if (hasGptExplanation && !hasAiExplanation) {
      await queryRunner.query(
        'ALTER TABLE `report_validation_item` RENAME COLUMN `gpt_explanation` TO `ai_explanation`',
      );
    }

    const hasGptScoreAvg = await queryRunner.hasColumn('report_validation_run', 'gpt_score_avg');
    const hasAiScoreAvg = await queryRunner.hasColumn('report_validation_run', 'ai_score_avg');
    if (hasGptScoreAvg && !hasAiScoreAvg) {
      await queryRunner.query('ALTER TABLE `report_validation_run` RENAME COLUMN `gpt_score_avg` TO `ai_score_avg`');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasAiScoreAvg = await queryRunner.hasColumn('report_validation_run', 'ai_score_avg');
    const hasGptScoreAvg = await queryRunner.hasColumn('report_validation_run', 'gpt_score_avg');
    if (hasAiScoreAvg && !hasGptScoreAvg) {
      await queryRunner.query('ALTER TABLE `report_validation_run` RENAME COLUMN `ai_score_avg` TO `gpt_score_avg`');
    }

    const hasAiExplanation = await queryRunner.hasColumn('report_validation_item', 'ai_explanation');
    const hasGptExplanation = await queryRunner.hasColumn('report_validation_item', 'gpt_explanation');
    if (hasAiExplanation && !hasGptExplanation) {
      await queryRunner.query(
        'ALTER TABLE `report_validation_item` RENAME COLUMN `ai_explanation` TO `gpt_explanation`',
      );
    }

    const hasAiCalibration = await queryRunner.hasColumn('report_validation_item', 'ai_calibration');
    const hasGptCalibration = await queryRunner.hasColumn('report_validation_item', 'gpt_calibration');
    if (hasAiCalibration && !hasGptCalibration) {
      await queryRunner.query(
        'ALTER TABLE `report_validation_item` RENAME COLUMN `ai_calibration` TO `gpt_calibration`',
      );
    }

    const hasAiScore = await queryRunner.hasColumn('report_validation_item', 'ai_score');
    const hasGptScore = await queryRunner.hasColumn('report_validation_item', 'gpt_score');
    if (hasAiScore && !hasGptScore) {
      await queryRunner.query('ALTER TABLE `report_validation_item` RENAME COLUMN `ai_score` TO `gpt_score`');
    }

    const hasAiVerdict = await queryRunner.hasColumn('report_validation_item', 'ai_verdict');
    const hasGptVerdict = await queryRunner.hasColumn('report_validation_item', 'gpt_verdict');
    if (hasAiVerdict && !hasGptVerdict) {
      await queryRunner.query('ALTER TABLE `report_validation_item` RENAME COLUMN `ai_verdict` TO `gpt_verdict`');
    }
  }
}
