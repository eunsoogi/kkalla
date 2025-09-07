import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class Migration1757204192259 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // market_recommendation 테이블 인덱스 추가
    await queryRunner.createIndex(
      'market_recommendation',
      new TableIndex({
        name: 'idx_market_recommendation_batch_id',
        columnNames: ['batch_id'],
      }),
    );

    await queryRunner.createIndex(
      'market_recommendation',
      new TableIndex({
        name: 'idx_market_recommendation_symbol_seq',
        columnNames: ['symbol', 'seq'],
      }),
    );

    await queryRunner.createIndex(
      'market_recommendation',
      new TableIndex({
        name: 'idx_market_recommendation_symbol_seq',
        columnNames: ['symbol', 'seq'],
      }),
    );

    await queryRunner.createIndex(
      'market_recommendation',
      new TableIndex({
        name: 'idx_market_recommendation_symbol_created_at',
        columnNames: ['symbol', 'created_at'],
      }),
    );

    // balance_recommendation 테이블 인덱스 추가
    await queryRunner.createIndex(
      'balance_recommendation',
      new TableIndex({
        name: 'idx_balance_recommendation_symbol',
        columnNames: ['symbol'],
      }),
    );

    await queryRunner.createIndex(
      'balance_recommendation',
      new TableIndex({
        name: 'idx_balance_recommendation_category_seq',
        columnNames: ['category', 'seq'],
      }),
    );

    await queryRunner.createIndex(
      'balance_recommendation',
      new TableIndex({
        name: 'idx_balance_recommendation_category_symbol_seq',
        columnNames: ['category', 'symbol', 'seq'],
      }),
    );

    await queryRunner.createIndex(
      'balance_recommendation',
      new TableIndex({
        name: 'idx_balance_recommendation_category_symbol_created_at',
        columnNames: ['category', 'symbol', 'created_at'],
      }),
    );

    // notify 테이블 인덱스 추가
    await queryRunner.createIndex(
      'notify',
      new TableIndex({
        name: 'idx_notify_user_seq',
        columnNames: ['user_id', 'seq'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // market_recommendation 테이블 인덱스 삭제
    await queryRunner.dropIndex('market_recommendation', 'idx_market_recommendation_batch_id');
    await queryRunner.dropIndex('market_recommendation', 'idx_market_recommendation_symbol_seq');
    await queryRunner.dropIndex('market_recommendation', 'idx_market_recommendation_symbol_created_at');

    // balance_recommendation 테이블 인덱스 삭제
    await queryRunner.dropIndex('balance_recommendation', 'idx_balance_recommendation_symbol');
    await queryRunner.dropIndex('balance_recommendation', 'idx_balance_recommendation_category_seq');
    await queryRunner.dropIndex('balance_recommendation', 'idx_balance_recommendation_category_symbol_seq');
    await queryRunner.dropIndex('balance_recommendation', 'idx_balance_recommendation_category_created_at');
    await queryRunner.dropIndex('balance_recommendation', 'idx_balance_recommendation_category_symbol_created_at');

    // notify 테이블 인덱스 삭제
    await queryRunner.dropIndex('notify', 'idx_notify_user_seq');
  }
}
