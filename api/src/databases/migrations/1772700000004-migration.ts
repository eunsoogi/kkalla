import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1772700000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasActionColumn = await queryRunner.hasColumn('allocation_recommendation', 'action');
    if (hasActionColumn) {
      await queryRunner.dropColumn('allocation_recommendation', 'action');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasActionColumn = await queryRunner.hasColumn('allocation_recommendation', 'action');
    if (!hasActionColumn) {
      await queryRunner.addColumn(
        'allocation_recommendation',
        new TableColumn({
          name: 'action',
          type: 'varchar',
          length: '16',
          isNullable: false,
          default: "'hold'",
        }),
      );
    }
  }
}
