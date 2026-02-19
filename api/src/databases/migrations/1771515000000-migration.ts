import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1771515000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE market_recommendation
      SET symbol = CONCAT(SUBSTRING_INDEX(UPPER(TRIM(symbol)), '-', -1), '/KRW')
      WHERE UPPER(TRIM(symbol)) LIKE 'KRW-%'
    `);

    await queryRunner.query(`
      UPDATE market_recommendation
      SET symbol = CONCAT(SUBSTRING_INDEX(UPPER(TRIM(symbol)), '-', 1), '/KRW')
      WHERE UPPER(TRIM(symbol)) LIKE '%-KRW'
    `);

    await queryRunner.query(`
      UPDATE market_recommendation
      SET symbol = CONCAT(SUBSTRING_INDEX(UPPER(TRIM(symbol)), '/', 1), '/KRW')
      WHERE TRIM(symbol) LIKE '%/%'
    `);

    await queryRunner.query(`
      UPDATE market_recommendation
      SET symbol = CONCAT(UPPER(TRIM(symbol)), '/KRW')
      WHERE TRIM(symbol) <> '' AND TRIM(symbol) NOT LIKE '%/%' AND TRIM(symbol) NOT LIKE '%-%'
    `);

    await queryRunner.query(`
      UPDATE balance_recommendation target
      LEFT JOIN balance_recommendation existing
        ON existing.batch_id = target.batch_id
       AND existing.id <> target.id
       AND existing.symbol = CONCAT(SUBSTRING_INDEX(UPPER(TRIM(target.symbol)), '-', -1), '/KRW')
      SET target.symbol = CONCAT(SUBSTRING_INDEX(UPPER(TRIM(target.symbol)), '-', -1), '/KRW')
      WHERE target.category IN ('coin_major', 'coin_minor')
        AND UPPER(TRIM(target.symbol)) LIKE 'KRW-%'
        AND existing.id IS NULL
    `);

    await queryRunner.query(`
      UPDATE balance_recommendation target
      LEFT JOIN balance_recommendation existing
        ON existing.batch_id = target.batch_id
       AND existing.id <> target.id
       AND existing.symbol = CONCAT(SUBSTRING_INDEX(UPPER(TRIM(target.symbol)), '-', 1), '/KRW')
      SET target.symbol = CONCAT(SUBSTRING_INDEX(UPPER(TRIM(target.symbol)), '-', 1), '/KRW')
      WHERE target.category IN ('coin_major', 'coin_minor')
        AND UPPER(TRIM(target.symbol)) LIKE '%-KRW'
        AND existing.id IS NULL
    `);

    await queryRunner.query(`
      UPDATE balance_recommendation target
      LEFT JOIN balance_recommendation existing
        ON existing.batch_id = target.batch_id
       AND existing.id <> target.id
       AND existing.symbol = CONCAT(SUBSTRING_INDEX(UPPER(TRIM(target.symbol)), '/', 1), '/KRW')
      SET target.symbol = CONCAT(SUBSTRING_INDEX(UPPER(TRIM(target.symbol)), '/', 1), '/KRW')
      WHERE target.category IN ('coin_major', 'coin_minor')
        AND TRIM(target.symbol) LIKE '%/%'
        AND existing.id IS NULL
    `);

    await queryRunner.query(`
      UPDATE balance_recommendation target
      LEFT JOIN balance_recommendation existing
        ON existing.batch_id = target.batch_id
       AND existing.id <> target.id
       AND existing.symbol = CONCAT(UPPER(TRIM(target.symbol)), '/KRW')
      SET target.symbol = CONCAT(UPPER(TRIM(target.symbol)), '/KRW')
      WHERE target.category IN ('coin_major', 'coin_minor')
        AND TRIM(target.symbol) <> ''
        AND TRIM(target.symbol) NOT LIKE '%/%'
        AND TRIM(target.symbol) NOT LIKE '%-%'
        AND existing.id IS NULL
    `);

    await queryRunner.query(`
      UPDATE history
      SET symbol = CONCAT(SUBSTRING_INDEX(UPPER(TRIM(symbol)), '-', -1), '/KRW')
      WHERE category IN ('coin_major', 'coin_minor') AND UPPER(TRIM(symbol)) LIKE 'KRW-%'
    `);

    await queryRunner.query(`
      UPDATE history
      SET symbol = CONCAT(SUBSTRING_INDEX(UPPER(TRIM(symbol)), '-', 1), '/KRW')
      WHERE category IN ('coin_major', 'coin_minor') AND UPPER(TRIM(symbol)) LIKE '%-KRW'
    `);

    await queryRunner.query(`
      UPDATE history
      SET symbol = CONCAT(SUBSTRING_INDEX(UPPER(TRIM(symbol)), '/', 1), '/KRW')
      WHERE category IN ('coin_major', 'coin_minor') AND TRIM(symbol) LIKE '%/%'
    `);

    await queryRunner.query(`
      UPDATE history
      SET symbol = CONCAT(UPPER(TRIM(symbol)), '/KRW')
      WHERE category IN ('coin_major', 'coin_minor')
        AND TRIM(symbol) <> ''
        AND TRIM(symbol) NOT LIKE '%/%'
        AND TRIM(symbol) NOT LIKE '%-%'
    `);

    await queryRunner.query(`
      UPDATE report_validation_item item
      JOIN market_recommendation source ON source.id = item.source_recommendation_id
      SET item.symbol = source.symbol
      WHERE item.report_type = 'market'
    `);

    await queryRunner.query(`
      UPDATE report_validation_item item
      JOIN balance_recommendation source ON source.id = item.source_recommendation_id
      SET item.symbol = source.symbol
      WHERE item.report_type = 'portfolio'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    void queryRunner;
    // one-way data correction migration
  }
}
