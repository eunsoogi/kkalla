import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1772900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of this.tradeColumns()) {
      const exists = await queryRunner.hasColumn('trade', column.name);
      if (!exists) {
        await queryRunner.addColumn('trade', column);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of this.tradeColumns()) {
      const exists = await queryRunner.hasColumn('trade', column.name);
      if (exists) {
        await queryRunner.dropColumn('trade', column.name);
      }
    }
  }

  private tradeColumns(): TableColumn[] {
    return [
      new TableColumn({
        name: 'decision_context_version',
        type: 'int',
        isNullable: true,
      }),
      new TableColumn({
        name: 'decision_portfolio_value',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'decision_symbol_notional',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'decision_requested_trade_notional',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'decision_capped_trade_notional',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'decision_expected_net_edge_rate',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'decision_position_class',
        type: 'varchar',
        length: '16',
        isNullable: true,
      }),
      new TableColumn({
        name: 'decision_regime_source',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    ];
  }
}
