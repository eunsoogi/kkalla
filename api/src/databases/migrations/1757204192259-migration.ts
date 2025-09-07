import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class Migration1757204192259 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // market_recommendation 테이블 인덱스 추가
    try {
      await queryRunner.createIndex(
        'market_recommendation',
        new TableIndex({
          name: 'idx_market_recommendation_batch_id',
          columnNames: ['batch_id'],
        }),
      );
    } catch (error) {
      console.warn('Error creating idx_market_recommendation_batch_id:', error);
    }

    try {
      await queryRunner.createIndex(
        'market_recommendation',
        new TableIndex({
          name: 'idx_market_recommendation_symbol_seq',
          columnNames: ['symbol', 'seq'],
        }),
      );
    } catch (error) {
      console.warn('Error creating idx_market_recommendation_symbol_seq:', error);
    }

    try {
      await queryRunner.createIndex(
        'market_recommendation',
        new TableIndex({
          name: 'idx_market_recommendation_symbol_created_at',
          columnNames: ['symbol', 'created_at'],
        }),
      );
    } catch (error) {
      console.warn('Error creating idx_market_recommendation_symbol_created_at:', error);
    }

    try {
      await queryRunner.createIndex(
        'market_recommendation',
        new TableIndex({
          name: 'idx_market_recommendation_created_at',
          columnNames: ['created_at'],
        }),
      );
    } catch (error) {
      console.warn('Error creating idx_market_recommendation_created_at:', error);
    }

    // balance_recommendation 테이블 인덱스 추가
    try {
      await queryRunner.createIndex(
        'balance_recommendation',
        new TableIndex({
          name: 'idx_balance_recommendation_symbol',
          columnNames: ['symbol'],
        }),
      );
    } catch (error) {
      console.warn('Error creating idx_balance_recommendation_symbol:', error);
    }

    try {
      await queryRunner.createIndex(
        'balance_recommendation',
        new TableIndex({
          name: 'idx_balance_recommendation_category_seq',
          columnNames: ['category', 'seq'],
        }),
      );
    } catch (error) {
      console.warn('Error creating idx_balance_recommendation_category_seq:', error);
    }

    try {
      await queryRunner.createIndex(
        'balance_recommendation',
        new TableIndex({
          name: 'idx_balance_recommendation_category_symbol_seq',
          columnNames: ['category', 'symbol', 'seq'],
        }),
      );
    } catch (error) {
      console.warn('Error creating idx_balance_recommendation_category_symbol_seq:', error);
    }

    try {
      await queryRunner.createIndex(
        'balance_recommendation',
        new TableIndex({
          name: 'idx_balance_recommendation_category_symbol_created_at',
          columnNames: ['category', 'symbol', 'created_at'],
        }),
      );
    } catch (error) {
      console.warn('Error creating idx_balance_recommendation_category_symbol_created_at:', error);
    }

    // notify 테이블 인덱스 추가
    try {
      await queryRunner.createIndex(
        'notify',
        new TableIndex({
          name: 'idx_notify_user_seq',
          columnNames: ['user_id', 'seq'],
        }),
      );
    } catch (error) {
      console.warn('Error creating idx_notify_user_seq:', error);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // market_recommendation 테이블 인덱스 삭제
    try {
      await queryRunner.dropIndex('market_recommendation', 'idx_market_recommendation_batch_id');
    } catch (error) {
      console.warn('Error dropping idx_market_recommendation_batch_id:', error);
    }

    try {
      await queryRunner.dropIndex('market_recommendation', 'idx_market_recommendation_symbol_seq');
    } catch (error) {
      console.warn('Error dropping idx_market_recommendation_symbol_seq:', error);
    }

    try {
      await queryRunner.dropIndex('market_recommendation', 'idx_market_recommendation_symbol_created_at');
    } catch (error) {
      console.warn('Error dropping idx_market_recommendation_symbol_created_at:', error);
    }

    try {
      await queryRunner.dropIndex('market_recommendation', 'idx_market_recommendation_created_at');
    } catch (error) {
      console.warn('Error dropping idx_market_recommendation_created_at:', error);
    }

    // balance_recommendation 테이블 인덱스 삭제
    try {
      await queryRunner.dropIndex('balance_recommendation', 'idx_balance_recommendation_symbol');
    } catch (error) {
      console.warn('Error dropping idx_balance_recommendation_symbol:', error);
    }

    try {
      await queryRunner.dropIndex('balance_recommendation', 'idx_balance_recommendation_category_seq');
    } catch (error) {
      console.warn('Error dropping idx_balance_recommendation_category_seq:', error);
    }

    try {
      await queryRunner.dropIndex('balance_recommendation', 'idx_balance_recommendation_category_symbol_seq');
    } catch (error) {
      console.warn('Error dropping idx_balance_recommendation_category_symbol_seq:', error);
    }

    try {
      await queryRunner.dropIndex('balance_recommendation', 'idx_balance_recommendation_category_created_at');
    } catch (error) {
      console.warn('Error dropping idx_balance_recommendation_category_created_at:', error);
    }

    try {
      await queryRunner.dropIndex('balance_recommendation', 'idx_balance_recommendation_category_symbol_created_at');
    } catch (error) {
      console.warn('Error dropping idx_balance_recommendation_category_symbol_created_at:', error);
    }

    // notify 테이블 인덱스 삭제
    try {
      await queryRunner.dropIndex('notify', 'idx_notify_user_seq');
    } catch (error) {
      console.warn('Error dropping idx_notify_user_seq:', error);
    }
  }
}
