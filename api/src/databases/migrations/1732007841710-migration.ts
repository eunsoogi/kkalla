import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migration1732007841710 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('inference', 'reflection');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'inference',
      new TableColumn({
        name: 'reflection',
        type: 'text',
        isNullable: false,
      }),
    );
  }
}
