import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class Migration1772900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of this.tradeColumns()) {
      const exists = await queryRunner.hasColumn('trade', column.name);
      if (!exists) {
        await queryRunner.addColumn('trade', column);
      }
    }

    const calibrationSnapshotTableExists = await queryRunner.hasTable('trade_cost_calibration_snapshot');
    if (!calibrationSnapshotTableExists) {
      await queryRunner.createTable(this.tradeCostCalibrationSnapshotTable());
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const calibrationSnapshotTableExists = await queryRunner.hasTable('trade_cost_calibration_snapshot');
    if (calibrationSnapshotTableExists) {
      await queryRunner.dropTable('trade_cost_calibration_snapshot');
    }

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
        name: 'decision_request_notional',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'decision_execution_notional',
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
      new TableColumn({
        name: 'decision_execution_urgency',
        type: 'varchar',
        length: '16',
        isNullable: true,
      }),
      new TableColumn({
        name: 'realized_cost_rate',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'cost_calibration_coefficient',
        type: 'double',
        isNullable: true,
      }),
    ];
  }

  private tradeCostCalibrationSnapshotTable(): Table {
    return new Table({
      name: 'trade_cost_calibration_snapshot',
      columns: [
        {
          name: 'id',
          type: 'varchar',
          length: '26',
          isPrimary: true,
          isNullable: false,
        },
        {
          name: 'version',
          type: 'int',
          isNullable: false,
        },
        {
          name: 'category',
          type: 'enum',
          enum: ['coin_major', 'coin_minor', 'nasdaq'],
          isNullable: false,
        },
        {
          name: 'cost_tier',
          type: 'varchar',
          length: '16',
          isNullable: false,
        },
        {
          name: 'position_class',
          type: 'varchar',
          length: '16',
          isNullable: false,
        },
        {
          name: 'regime_source',
          type: 'varchar',
          length: '32',
          isNullable: false,
        },
        {
          name: 'sample_size',
          type: 'int',
          isNullable: false,
        },
        {
          name: 'window_start',
          type: 'datetime',
          isNullable: false,
        },
        {
          name: 'window_end',
          type: 'datetime',
          isNullable: false,
        },
        {
          name: 'last_trade_at',
          type: 'datetime',
          isNullable: false,
        },
        {
          name: 'raw_multiplier',
          type: 'double',
          isNullable: false,
        },
        {
          name: 'applied_multiplier',
          type: 'double',
          isNullable: false,
        },
        {
          name: 'clamp_applied',
          type: 'tinyint',
          isNullable: false,
        },
        {
          name: 'status',
          type: 'varchar',
          length: '16',
          isNullable: false,
        },
        {
          name: 'created_at',
          type: 'datetime',
          precision: 6,
          default: 'CURRENT_TIMESTAMP(6)',
          isNullable: false,
        },
        {
          name: 'updated_at',
          type: 'datetime',
          precision: 6,
          default: 'CURRENT_TIMESTAMP(6)',
          onUpdate: 'CURRENT_TIMESTAMP(6)',
          isNullable: false,
        },
      ],
      indices: [
        new TableIndex({
          name: 'idx_trade_cost_calibration_snapshot_bucket',
          isUnique: true,
          columnNames: ['version', 'category', 'cost_tier', 'position_class', 'regime_source'],
        }),
      ],
    });
  }
}
