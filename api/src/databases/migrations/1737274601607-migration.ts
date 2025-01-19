import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class Migration1737274601607 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      'notify',
      new TableIndex({
        name: 'idx_notify_user_seq',
        columnNames: ['user_id', 'seq'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('notify', 'idx_notify_user_seq');
  }
}
