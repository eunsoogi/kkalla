import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1772700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addTradeExecutionTelemetryColumns(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropTradeExecutionTelemetryColumns(queryRunner);
  }

  private async addTradeExecutionTelemetryColumns(queryRunner: QueryRunner): Promise<void> {
    const columns: TableColumn[] = [
      new TableColumn({
        name: 'execution_mode',
        type: 'varchar',
        length: '24',
        isNullable: true,
      }),
      new TableColumn({
        name: 'order_type',
        type: 'varchar',
        length: '16',
        isNullable: true,
      }),
      new TableColumn({
        name: 'time_in_force',
        type: 'varchar',
        length: '16',
        isNullable: true,
      }),
      new TableColumn({
        name: 'request_price',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'average_price',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'requested_amount',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'filled_amount',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'filled_ratio',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'order_status',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
      new TableColumn({
        name: 'expected_edge_rate',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'estimated_cost_rate',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'spread_rate',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'impact_rate',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'missed_opportunity_cost',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'gate_bypassed_reason',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'trigger_reason',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    ];

    for (const column of columns) {
      await this.addColumnIfMissing(queryRunner, 'trade', column);
    }
  }

  private async dropTradeExecutionTelemetryColumns(queryRunner: QueryRunner): Promise<void> {
    const columns = [
      'trigger_reason',
      'gate_bypassed_reason',
      'missed_opportunity_cost',
      'impact_rate',
      'spread_rate',
      'estimated_cost_rate',
      'expected_edge_rate',
      'order_status',
      'filled_ratio',
      'filled_amount',
      'requested_amount',
      'average_price',
      'request_price',
      'time_in_force',
      'order_type',
      'execution_mode',
    ];

    for (const column of columns) {
      await this.dropColumnIfExists(queryRunner, 'trade', column);
    }
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
