import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1772700000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: TableColumn[] = [
      new TableColumn({
        name: 'decision_confidence',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'expected_volatility_pct',
        type: 'double',
        isNullable: true,
      }),
      new TableColumn({
        name: 'risk_flags',
        type: 'text',
        isNullable: true,
      }),
    ];

    for (const column of columns) {
      await this.addColumnIfMissing(queryRunner, 'allocation_recommendation', column);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const columns = ['risk_flags', 'expected_volatility_pct', 'decision_confidence'];

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
