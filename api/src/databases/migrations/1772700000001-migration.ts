import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1772700000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: TableColumn[] = [
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
    ];

    for (const column of columns) {
      await this.addColumnIfMissing(queryRunner, 'allocation_recommendation', column);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columns = ['impact_rate', 'spread_rate', 'estimated_cost_rate', 'expected_edge_rate'];

    for (const column of columns) {
      await this.dropColumnIfExists(queryRunner, 'allocation_recommendation', column);
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
