import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1772500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addMarketSignalColumns(queryRunner);
    await this.addAllocationRecommendationColumns(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropAllocationRecommendationColumns(queryRunner);
    await this.dropMarketSignalColumns(queryRunner);
  }

  private async addMarketSignalColumns(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(
      queryRunner,
      'market_signal',
      new TableColumn({
        name: 'btc_dominance',
        type: 'double',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'market_signal',
      new TableColumn({
        name: 'altcoin_index',
        type: 'double',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'market_signal',
      new TableColumn({
        name: 'market_regime_as_of',
        type: 'datetime',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'market_signal',
      new TableColumn({
        name: 'market_regime_source',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'market_signal',
      new TableColumn({
        name: 'market_regime_is_stale',
        type: 'boolean',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'market_signal',
      new TableColumn({
        name: 'feargreed_index',
        type: 'double',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'market_signal',
      new TableColumn({
        name: 'feargreed_classification',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'market_signal',
      new TableColumn({
        name: 'feargreed_timestamp',
        type: 'datetime',
        isNullable: true,
      }),
    );
  }

  private async addAllocationRecommendationColumns(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_recommendation',
      new TableColumn({
        name: 'btc_dominance',
        type: 'double',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_recommendation',
      new TableColumn({
        name: 'altcoin_index',
        type: 'double',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_recommendation',
      new TableColumn({
        name: 'market_regime_as_of',
        type: 'datetime',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_recommendation',
      new TableColumn({
        name: 'market_regime_source',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_recommendation',
      new TableColumn({
        name: 'market_regime_is_stale',
        type: 'boolean',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_recommendation',
      new TableColumn({
        name: 'feargreed_index',
        type: 'double',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_recommendation',
      new TableColumn({
        name: 'feargreed_classification',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_recommendation',
      new TableColumn({
        name: 'feargreed_timestamp',
        type: 'datetime',
        isNullable: true,
      }),
    );
  }

  private async dropMarketSignalColumns(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumnIfExists(queryRunner, 'market_signal', 'feargreed_timestamp');
    await this.dropColumnIfExists(queryRunner, 'market_signal', 'feargreed_classification');
    await this.dropColumnIfExists(queryRunner, 'market_signal', 'feargreed_index');
    await this.dropColumnIfExists(queryRunner, 'market_signal', 'market_regime_is_stale');
    await this.dropColumnIfExists(queryRunner, 'market_signal', 'market_regime_source');
    await this.dropColumnIfExists(queryRunner, 'market_signal', 'market_regime_as_of');
    await this.dropColumnIfExists(queryRunner, 'market_signal', 'altcoin_index');
    await this.dropColumnIfExists(queryRunner, 'market_signal', 'btc_dominance');
  }

  private async dropAllocationRecommendationColumns(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumnIfExists(queryRunner, 'allocation_recommendation', 'feargreed_timestamp');
    await this.dropColumnIfExists(queryRunner, 'allocation_recommendation', 'feargreed_classification');
    await this.dropColumnIfExists(queryRunner, 'allocation_recommendation', 'feargreed_index');
    await this.dropColumnIfExists(queryRunner, 'allocation_recommendation', 'market_regime_is_stale');
    await this.dropColumnIfExists(queryRunner, 'allocation_recommendation', 'market_regime_source');
    await this.dropColumnIfExists(queryRunner, 'allocation_recommendation', 'market_regime_as_of');
    await this.dropColumnIfExists(queryRunner, 'allocation_recommendation', 'altcoin_index');
    await this.dropColumnIfExists(queryRunner, 'allocation_recommendation', 'btc_dominance');
  }

  private async addColumnIfMissing(queryRunner: QueryRunner, table: string, column: TableColumn): Promise<void> {
    const exists = await queryRunner.hasColumn(table, column.name);
    if (!exists) {
      await queryRunner.addColumn(table, column);
    }
  }

  private async dropColumnIfExists(queryRunner: QueryRunner, table: string, column: string): Promise<void> {
    const exists = await queryRunner.hasColumn(table, column);
    if (exists) {
      await queryRunner.dropColumn(table, column);
    }
  }
}
