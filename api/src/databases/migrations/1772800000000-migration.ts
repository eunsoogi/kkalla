import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1772800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumnIfExists(queryRunner, 'trade', 'order_status');
    await this.dropColumnIfExists(queryRunner, 'trade', 'filled_ratio');
    await this.dropColumnIfExists(queryRunner, 'trade', 'execution_mode');
    await this.dropColumnIfExists(queryRunner, 'trade', 'order_type');
    await this.dropColumnIfExists(queryRunner, 'trade', 'time_in_force');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(
      queryRunner,
      'trade',
      new TableColumn({
        name: 'time_in_force',
        type: 'varchar',
        length: '16',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'trade',
      new TableColumn({
        name: 'order_type',
        type: 'varchar',
        length: '16',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'trade',
      new TableColumn({
        name: 'execution_mode',
        type: 'varchar',
        length: '24',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'trade',
      new TableColumn({
        name: 'filled_ratio',
        type: 'double',
        isNullable: true,
      }),
    );
    await this.addColumnIfMissing(
      queryRunner,
      'trade',
      new TableColumn({
        name: 'order_status',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );
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
