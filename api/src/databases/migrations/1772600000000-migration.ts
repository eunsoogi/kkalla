import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1772600000000 implements MigrationInterface {
  /**
   * allocation_audit_item는 데이터 누적량이 클 수 있어 startup 부하 분리를 위해 별도 마이그레이션으로 유지한다.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addAllocationAuditItemColumns(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropAllocationAuditItemColumns(queryRunner);
  }

  private async addAllocationAuditItemColumns(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_audit_item',
      new TableColumn({
        name: 'recommendation_btc_dominance',
        type: 'double',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_audit_item',
      new TableColumn({
        name: 'recommendation_altcoin_index',
        type: 'double',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_audit_item',
      new TableColumn({
        name: 'recommendation_market_regime_as_of',
        type: 'datetime',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_audit_item',
      new TableColumn({
        name: 'recommendation_market_regime_source',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_audit_item',
      new TableColumn({
        name: 'recommendation_market_regime_is_stale',
        type: 'boolean',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_audit_item',
      new TableColumn({
        name: 'recommendation_feargreed_index',
        type: 'double',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_audit_item',
      new TableColumn({
        name: 'recommendation_feargreed_classification',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'allocation_audit_item',
      new TableColumn({
        name: 'recommendation_feargreed_timestamp',
        type: 'datetime',
        isNullable: true,
      }),
    );
  }

  private async dropAllocationAuditItemColumns(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumnIfExists(queryRunner, 'allocation_audit_item', 'recommendation_feargreed_timestamp');
    await this.dropColumnIfExists(queryRunner, 'allocation_audit_item', 'recommendation_feargreed_classification');
    await this.dropColumnIfExists(queryRunner, 'allocation_audit_item', 'recommendation_feargreed_index');
    await this.dropColumnIfExists(queryRunner, 'allocation_audit_item', 'recommendation_market_regime_is_stale');
    await this.dropColumnIfExists(queryRunner, 'allocation_audit_item', 'recommendation_market_regime_source');
    await this.dropColumnIfExists(queryRunner, 'allocation_audit_item', 'recommendation_market_regime_as_of');
    await this.dropColumnIfExists(queryRunner, 'allocation_audit_item', 'recommendation_altcoin_index');
    await this.dropColumnIfExists(queryRunner, 'allocation_audit_item', 'recommendation_btc_dominance');
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
