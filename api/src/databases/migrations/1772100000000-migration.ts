import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class Migration1772100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tradeTable = await queryRunner.getTable('trade');
    const hasTradeUserSeqIndex = tradeTable?.indices.some((index) => index.name === 'idx_trade_user_seq');
    if (!hasTradeUserSeqIndex) {
      await queryRunner.createIndex(
        'trade',
        new TableIndex({
          name: 'idx_trade_user_seq',
          columnNames: ['user_id', 'seq'],
        }),
      );
    }

    const userCategoryTable = await queryRunner.getTable('user_category');
    const hasUserCategoryIndex = userCategoryTable?.indices.some(
      (index) => index.name === 'idx_user_category_user_enabled_category',
    );
    if (!hasUserCategoryIndex) {
      await queryRunner.createIndex(
        'user_category',
        new TableIndex({
          name: 'idx_user_category_user_enabled_category',
          columnNames: ['user_id', 'enabled', 'category'],
        }),
      );
    }

    const hasRecommendationPrice = await queryRunner.hasColumn('market_recommendation', 'recommendation_price');
    if (!hasRecommendationPrice) {
      await queryRunner.addColumn(
        'market_recommendation',
        new TableColumn({
          name: 'recommendation_price',
          type: 'double',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasRecommendationPrice = await queryRunner.hasColumn('market_recommendation', 'recommendation_price');
    if (hasRecommendationPrice) {
      await queryRunner.dropColumn('market_recommendation', 'recommendation_price');
    }

    const tradeTable = await queryRunner.getTable('trade');
    const tradeUserSeqIndex = tradeTable?.indices.find((index) => index.name === 'idx_trade_user_seq');
    if (tradeUserSeqIndex) {
      await queryRunner.dropIndex('trade', tradeUserSeqIndex);
    }

    const userCategoryTable = await queryRunner.getTable('user_category');
    const userCategoryIndex = userCategoryTable?.indices.find(
      (index) => index.name === 'idx_user_category_user_enabled_category',
    );
    if (userCategoryIndex) {
      await queryRunner.dropIndex('user_category', userCategoryIndex);
    }
  }
}
