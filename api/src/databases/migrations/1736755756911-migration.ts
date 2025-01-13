import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1736755756911 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'history',
      new TableColumn({
        name: 'index',
        type: 'integer',
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('history', 'index');
  }
}
