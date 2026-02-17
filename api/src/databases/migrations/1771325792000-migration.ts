import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1771325792000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasRate = await queryRunner.hasColumn('balance_recommendation', 'rate');
    const hasIntensity = await queryRunner.hasColumn('balance_recommendation', 'intensity');
    if (hasRate && !hasIntensity) {
      await queryRunner.query('ALTER TABLE `balance_recommendation` RENAME COLUMN `rate` TO `intensity`');
    }

    const hasPrevRate = await queryRunner.hasColumn('balance_recommendation', 'prev_rate');
    const hasPrevIntensity = await queryRunner.hasColumn('balance_recommendation', 'prev_intensity');
    if (hasPrevRate && !hasPrevIntensity) {
      await queryRunner.query('ALTER TABLE `balance_recommendation` RENAME COLUMN `prev_rate` TO `prev_intensity`');
    }

    const hasBuyScore = await queryRunner.hasColumn('balance_recommendation', 'buy_score');
    if (!hasBuyScore) {
      await queryRunner.addColumn(
        'balance_recommendation',
        new TableColumn({
          name: 'buy_score',
          type: 'double',
          isNullable: false,
          default: 0,
        }),
      );
    }

    const hasSellScore = await queryRunner.hasColumn('balance_recommendation', 'sell_score');
    if (!hasSellScore) {
      await queryRunner.addColumn(
        'balance_recommendation',
        new TableColumn({
          name: 'sell_score',
          type: 'double',
          isNullable: false,
          default: 0,
        }),
      );
    }

    const hasModelTargetWeight = await queryRunner.hasColumn('balance_recommendation', 'model_target_weight');
    if (!hasModelTargetWeight) {
      await queryRunner.addColumn(
        'balance_recommendation',
        new TableColumn({
          name: 'model_target_weight',
          type: 'double',
          isNullable: false,
          default: 0,
        }),
      );
    }

    const hasAction = await queryRunner.hasColumn('balance_recommendation', 'action');
    if (!hasAction) {
      await queryRunner.addColumn(
        'balance_recommendation',
        new TableColumn({
          name: 'action',
          type: 'varchar',
          length: '16',
          isNullable: false,
          default: "'hold'",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasAction = await queryRunner.hasColumn('balance_recommendation', 'action');
    if (hasAction) {
      await queryRunner.dropColumn('balance_recommendation', 'action');
    }

    const hasModelTargetWeight = await queryRunner.hasColumn('balance_recommendation', 'model_target_weight');
    if (hasModelTargetWeight) {
      await queryRunner.dropColumn('balance_recommendation', 'model_target_weight');
    }

    const hasSellScore = await queryRunner.hasColumn('balance_recommendation', 'sell_score');
    if (hasSellScore) {
      await queryRunner.dropColumn('balance_recommendation', 'sell_score');
    }

    const hasBuyScore = await queryRunner.hasColumn('balance_recommendation', 'buy_score');
    if (hasBuyScore) {
      await queryRunner.dropColumn('balance_recommendation', 'buy_score');
    }

    const hasIntensity = await queryRunner.hasColumn('balance_recommendation', 'intensity');
    const hasRate = await queryRunner.hasColumn('balance_recommendation', 'rate');
    if (hasIntensity && !hasRate) {
      await queryRunner.query('ALTER TABLE `balance_recommendation` RENAME COLUMN `intensity` TO `rate`');
    }

    const hasPrevIntensity = await queryRunner.hasColumn('balance_recommendation', 'prev_intensity');
    const hasPrevRate = await queryRunner.hasColumn('balance_recommendation', 'prev_rate');
    if (hasPrevIntensity && !hasPrevRate) {
      await queryRunner.query('ALTER TABLE `balance_recommendation` RENAME COLUMN `prev_intensity` TO `prev_rate`');
    }
  }
}
