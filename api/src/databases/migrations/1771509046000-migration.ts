import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class Migration1771509046000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'report_validation_run',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'seq',
            type: 'bigint',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'report_type',
            type: 'enum',
            enum: ['market', 'portfolio'],
            isNullable: false,
          },
          {
            name: 'source_batch_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'horizon_hours',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'running', 'completed', 'failed'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'item_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'completed_count',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'deterministic_score_avg',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'gpt_score_avg',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'overall_score',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'summary',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
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
      }),
      true,
    );

    await queryRunner.createIndex(
      'report_validation_run',
      new TableIndex({
        name: 'idx_report_validation_run_report_type_batch_horizon',
        columnNames: ['report_type', 'source_batch_id', 'horizon_hours'],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'report_validation_item',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'seq',
            type: 'bigint',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'run_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'report_type',
            type: 'enum',
            enum: ['market', 'portfolio'],
            isNullable: false,
          },
          {
            name: 'source_recommendation_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'source_batch_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'symbol',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'horizon_hours',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'due_at',
            type: 'datetime',
            isNullable: false,
          },
          {
            name: 'recommendation_created_at',
            type: 'datetime',
            isNullable: false,
          },
          {
            name: 'recommendation_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'recommendation_confidence',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'recommendation_weight',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'recommendation_intensity',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'recommendation_action',
            type: 'varchar',
            length: '16',
            isNullable: true,
          },
          {
            name: 'recommendation_price',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'evaluated_price',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'return_pct',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'direction_hit',
            type: 'boolean',
            isNullable: true,
          },
          {
            name: 'realized_trade_pnl',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'realized_trade_amount',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'trade_roi_pct',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'deterministic_score',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'gpt_verdict',
            type: 'enum',
            enum: ['good', 'mixed', 'bad', 'invalid'],
            isNullable: true,
          },
          {
            name: 'gpt_score',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'gpt_calibration',
            type: 'double',
            isNullable: true,
          },
          {
            name: 'gpt_explanation',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'next_guardrail',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'running', 'completed', 'failed'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'evaluated_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
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
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'report_validation_item',
      new TableForeignKey({
        columnNames: ['run_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'report_validation_run',
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'report_validation_item',
      new TableIndex({
        name: 'idx_report_validation_item_source_recommendation_horizon',
        columnNames: ['source_recommendation_id', 'horizon_hours'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'report_validation_item',
      new TableIndex({
        name: 'idx_report_validation_item_status_due_at',
        columnNames: ['status', 'due_at'],
      }),
    );

    await queryRunner.createIndex(
      'report_validation_item',
      new TableIndex({
        name: 'idx_report_validation_item_report_type_symbol_created_at',
        columnNames: ['report_type', 'symbol', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'report_validation_item',
      new TableIndex({
        name: 'idx_report_validation_item_source_batch_horizon',
        columnNames: ['source_batch_id', 'horizon_hours'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('report_validation_item');
    await queryRunner.dropTable('report_validation_run');
  }
}
